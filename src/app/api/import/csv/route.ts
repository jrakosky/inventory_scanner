import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect delimiter
  const firstLine = lines[0];
  const delimiters = [',', '\t', ';'];
  let delimiter = ',';
  let maxCount = 0;
  for (const d of delimiters) {
    const count = (firstLine.match(new RegExp(d === '\t' ? '\\t' : '\\' + d, 'g')) || []).length;
    if (count > maxCount) { maxCount = count; delimiter = d; }
  }

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function findColumn(headers: string[], ...patterns: string[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex(h => h.includes(pattern));
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const mode = formData.get("mode") as string || "skip"; // "skip" or "update"

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    if (headers.length === 0) return NextResponse.json({ error: "Empty CSV" }, { status: 400 });

    // Find column indices
    const barcodeCol = findColumn(headers, 'barcode', 'upc', 'ean', 'sku', 'code', 'item_number', 'item_id');
    const nameCol = findColumn(headers, 'name', 'title', 'product_name', 'item_name', 'item');
    const descCol = findColumn(headers, 'description', 'desc', 'details');
    const qtyCol = findColumn(headers, 'quantity', 'qty', 'stock', 'count', 'on_hand');
    const binCol = findColumn(headers, 'bin', 'shelf');
    const rowCol = findColumn(headers, 'row');
    const aisleCol = findColumn(headers, 'aisle');
    const zoneCol = findColumn(headers, 'zone', 'warehouse', 'location', 'loc');
    const unitCol = findColumn(headers, 'unit', 'uom', 'unit_of_measure');
    const categoryCol = findColumn(headers, 'category', 'cat', 'type', 'group', 'department');
    const conditionCol = findColumn(headers, 'condition', 'status');
    const costCol = findColumn(headers, 'cost_price', 'cost', 'price', 'unit_cost');
    const minStockCol = findColumn(headers, 'min_stock', 'reorder', 'minimum');

    if (barcodeCol === -1) return NextResponse.json({ error: "No barcode/UPC/SKU column found. Available columns: " + headers.join(", ") }, { status: 400 });
    if (nameCol === -1) return NextResponse.json({ error: "No name/title column found. Available columns: " + headers.join(", ") }, { status: 400 });

    const results = { imported: 0, updated: 0, skipped: 0, errors: [] as string[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const barcode = row[barcodeCol]?.trim();
      const name = row[nameCol]?.trim();

      if (!barcode) { results.skipped++; continue; }
      if (!name) { results.errors.push(`Row ${i + 2}: Missing name`); results.skipped++; continue; }

      const validConditions = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];
      let condition = conditionCol !== -1 ? (row[conditionCol]?.trim().toUpperCase() || 'GOOD') : 'GOOD';
      if (!validConditions.includes(condition)) condition = 'GOOD';

      const data = {
        name,
        description: descCol !== -1 ? row[descCol]?.trim() || null : null,
        quantity: qtyCol !== -1 ? parseInt(row[qtyCol]) || 1 : 1,
        bin: binCol !== -1 ? row[binCol]?.trim() || null : null,
        row: rowCol !== -1 ? row[rowCol]?.trim() || null : null,
        aisle: aisleCol !== -1 ? row[aisleCol]?.trim() || null : null,
        zone: zoneCol !== -1 ? row[zoneCol]?.trim() || null : null,
        unit: unitCol !== -1 ? row[unitCol]?.trim() || null : null,
        category: categoryCol !== -1 ? row[categoryCol]?.trim() || null : null,
        condition: condition as any,
        costPrice: costCol !== -1 && row[costCol] ? parseFloat(row[costCol]) || null : null,
        minStock: minStockCol !== -1 ? parseInt(row[minStockCol]) || 0 : 0,
      };

      try {
        const existing = await prisma.inventoryItem.findUnique({ where: { barcode } });

        if (existing) {
          if (mode === "update") {
            await prisma.inventoryItem.update({ where: { barcode }, data });
            await prisma.scanLog.create({
              data: { barcode, action: "UPDATED", scannedById: userId, inventoryItemId: existing.id, notes: "CSV import update" },
            });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          const newItem = await prisma.inventoryItem.create({
            data: { barcode, ...data, createdById: userId },
          });
          await prisma.scanLog.create({
            data: { barcode, action: "CREATED", quantityChange: data.quantity, scannedById: userId, inventoryItemId: newItem.id, notes: "CSV import" },
          });
          results.imported++;
        }
      } catch (err: any) {
        results.errors.push(`Row ${i + 2} (${barcode}): ${err.message?.slice(0, 100)}`);
      }
    }

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to process CSV: " + err.message }, { status: 500 });
  }
}

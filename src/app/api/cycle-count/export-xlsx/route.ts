import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "Missing cycle count id" }, { status: 400 });

  const cycleCount = await prisma.cycleCount.findUnique({
    where: { id },
    include: {
      warehouse: true,
      assignedTo: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
      entries: {
        include: {
          inventoryItem: true,
          countedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!cycleCount)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "InvScan";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { width: 32 },
    { width: 52 },
  ];

  const summaryRows: Array<[string, string | number | Date | null]> = [
    ["Document number", cycleCount.documentNumber],
    ["Description", cycleCount.description],
    ["State", cycleCount.state],
    ["Warehouse", cycleCount.warehouse?.name ?? ""],
    ["Assigned to", cycleCount.assignedTo?.name || cycleCount.assignedTo?.email || ""],
    ["Created by", cycleCount.createdBy?.name || cycleCount.createdBy?.email || ""],
    ["Start date", cycleCount.startDate ?? ""],
    ["End date", cycleCount.endDate ?? ""],
    ["Excluded allocated quantity", cycleCount.excludedAllocatedQuantity ? "Yes" : "No"],
    ["Show quantity on hand", cycleCount.showQuantityOnHand ? "Yes" : "No"],
    ["Total lines", cycleCount.entries.length],
    ["Lines counted", cycleCount.entries.filter(e => e.lineCountStatus === "counted").length],
    ["Lines skipped", cycleCount.entries.filter(e => e.lineCountStatus === "skipped").length],
  ];
  summaryRows.forEach(([label, value]) => {
    const row = summary.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  });

  const lines = workbook.addWorksheet("Lines");
  lines.columns = [
    { header: "Item ID", key: "itemId", width: 22 },
    { header: "Item name", key: "itemName", width: 36 },
    { header: "Zone", key: "zone", width: 10 },
    { header: "Aisle", key: "aisle", width: 10 },
    { header: "Row", key: "row", width: 10 },
    { header: "Bin", key: "bin", width: 10 },
    { header: "Serial", key: "serial", width: 18 },
    { header: "Lot", key: "lot", width: 14 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "On hand", key: "onHand", width: 12 },
    { header: "Counted", key: "counted", width: 12 },
    { header: "Damaged", key: "damaged", width: 12 },
    { header: "Variance", key: "variance", width: 12 },
    { header: "Status", key: "status", width: 14 },
    { header: "Counted by", key: "countedBy", width: 28 },
    { header: "Adjustment reason", key: "reason", width: 40 },
    { header: "Counted at", key: "countedAt", width: 20 },
  ];

  const headerRow = lines.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEEEEEE" },
  };
  headerRow.alignment = { vertical: "middle" };
  lines.views = [{ state: "frozen", ySplit: 1 }];

  const numericCols = ["onHand", "counted", "damaged", "variance"];
  for (const e of cycleCount.entries) {
    const onHand = e.onHand?.toNumber() ?? null;
    const counted = e.counted?.toNumber() ?? null;
    const variance = counted !== null && onHand !== null ? counted - onHand : null;
    lines.addRow({
      itemId: e.inventoryItem.barcode,
      itemName: e.inventoryItem.name,
      zone: e.zone ?? "",
      aisle: e.aisle ?? "",
      row: e.row ?? "",
      bin: e.bin ?? "",
      serial: e.serialNumber ?? "",
      lot: e.lotNumber ?? "",
      unit: e.inventoryItem.unit ?? "",
      onHand,
      counted,
      damaged: e.damaged?.toNumber() ?? null,
      variance,
      status: e.lineCountStatus,
      countedBy: e.countedBy?.name || e.countedBy?.email || "",
      reason: e.adjustmentReason ?? "",
      countedAt: e.countedAt ?? null,
    });
  }

  numericCols.forEach(key => {
    const col = lines.getColumn(key);
    col.numFmt = "0.00";
  });
  lines.getColumn("countedAt").numFmt = "yyyy-mm-dd hh:mm";

  const buffer = await workbook.xlsx.writeBuffer();
  const filenameSlug = cycleCount.documentNumber.replace(/[^A-Za-z0-9_-]+/g, "-");

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filenameSlug}-${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.inventoryItem.findMany({
    orderBy: { name: "asc" },
    include: {
      createdBy: { select: { name: true, email: true } },
      _count: { select: { scanLogs: true } },
    },
  });

  // Build CSV
  const headers = [
    "Barcode",
    "Name",
    "Description",
    "Quantity",
    "Bin",
    "Row",
    "Aisle",
    "Zone",
    "Unit",
    "Category",
    "Condition",
    "Min Stock",
    "Cost Price",
    "Sage Item ID",
    "Created By",
    "Total Scans",
    "Created At",
    "Updated At",
  ];

  const rows = items.map((item) => [
    item.barcode,
    escapeCsv(item.name),
    escapeCsv(item.description || ""),
    item.quantity.toString(),
    escapeCsv(item.bin || ""),
    escapeCsv(item.row || ""),
    escapeCsv(item.aisle || ""),
    escapeCsv(item.zone || ""),
    escapeCsv(item.unit || ""),
    escapeCsv(item.category || ""),
    item.condition,
    item.minStock.toString(),
    item.costPrice?.toString() || "",
    item.sageItemId || "",
    item.createdBy.name || item.createdBy.email,
    item._count.scanLogs.toString(),
    item.createdAt.toISOString(),
    item.updatedAt.toISOString(),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

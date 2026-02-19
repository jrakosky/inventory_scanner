import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      entries: {
        include: {
          inventoryItem: true,
          countedBy: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!cycleCount)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const headers = ["Item ID", "Item Name", "Zone", "Aisle", "Row", "Bin", "Unit", "Expected Qty", "Counted Qty", "Variance", "Status", "Counted By", "Adjustment Reason", "Counted At"];

  const rows = cycleCount.entries.map(e => [
    e.inventoryItem.barcode,
    escapeCsv(e.inventoryItem.name),
    escapeCsv(e.inventoryItem.zone || ""),
    escapeCsv(e.inventoryItem.aisle || ""),
    escapeCsv(e.inventoryItem.row || ""),
    escapeCsv(e.inventoryItem.bin || ""),
    escapeCsv(e.inventoryItem.unit || ""),
    e.expectedQty.toString(),
    e.countedQty?.toString() || "",
    e.variance?.toString() || "",
    e.status,
    e.countedBy?.name || e.countedBy?.email || "",
    escapeCsv(e.adjustmentReason || ""),
    e.countedAt?.toISOString() || "",
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cycle-count-${cycleCount.name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

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
      warehouse: true,
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

  const headers = [
    "Item ID", "Item Name",
    "Zone", "Aisle", "Row", "Bin", "Serial", "Lot",
    "Unit", "On Hand", "Counted", "Damaged", "Variance",
    "Status", "Counted By", "Adjustment Reason", "Counted At",
  ];

  const rows = cycleCount.entries.map(e => {
    const onHand = e.onHand?.toNumber() ?? 0;
    const counted = e.counted?.toNumber() ?? null;
    const variance = counted !== null ? (counted - onHand).toFixed(2) : "";
    return [
      e.inventoryItem.barcode,
      escapeCsv(e.inventoryItem.name),
      escapeCsv(e.zone || ""),
      escapeCsv(e.aisle || ""),
      escapeCsv(e.row || ""),
      escapeCsv(e.bin || ""),
      escapeCsv(e.serialNumber || ""),
      escapeCsv(e.lotNumber || ""),
      escapeCsv(e.inventoryItem.unit || ""),
      e.onHand?.toString() ?? "",
      e.counted?.toString() ?? "",
      e.damaged?.toString() ?? "",
      variance,
      e.lineCountStatus,
      e.countedBy?.name || e.countedBy?.email || "",
      escapeCsv(e.adjustmentReason || ""),
      e.countedAt?.toISOString() || "",
    ];
  });

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const filenameSlug = cycleCount.documentNumber.replace(/[^A-Za-z0-9_-]+/g, "-");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameSlug}-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET - List cycle counts or get a single one
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const status = searchParams.get("status");

  if (id) {
    const cycleCount = await prisma.cycleCount.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            inventoryItem: true,
            countedBy: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        createdBy: { select: { name: true, email: true } },
        _count: { select: { entries: true } },
      },
    });
    if (!cycleCount)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Calculate summary stats
    const totalEntries = cycleCount.entries.length;
    const countedEntries = cycleCount.entries.filter(e => e.status === "COUNTED").length;
    const skippedEntries = cycleCount.entries.filter(e => e.status === "SKIPPED").length;
    const pendingEntries = cycleCount.entries.filter(e => e.status === "PENDING").length;
    const varianceEntries = cycleCount.entries.filter(e => e.status === "COUNTED" && e.variance !== 0);
    const totalVariance = varianceEntries.reduce((sum, e) => sum + Math.abs(e.variance || 0), 0);

    return NextResponse.json({
      ...cycleCount,
      summary: { totalEntries, countedEntries, skippedEntries, pendingEntries, varianceCount: varianceEntries.length, totalVariance },
    });
  }

  // List all cycle counts
  const where: any = {};
  if (status) where.status = status;

  const cycleCounts = await prisma.cycleCount.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true, email: true } },
      _count: { select: { entries: true } },
      entries: {
        select: { status: true, variance: true },
      },
    },
  });

  const formatted = cycleCounts.map(cc => {
    const total = cc.entries.length;
    const counted = cc.entries.filter(e => e.status === "COUNTED").length;
    const withVariance = cc.entries.filter(e => e.status === "COUNTED" && e.variance !== 0).length;
    return {
      id: cc.id,
      name: cc.name,
      status: cc.status,
      filterType: cc.filterType,
      filterValue: cc.filterValue,
      notes: cc.notes,
      createdBy: cc.createdBy,
      createdAt: cc.createdAt,
      startedAt: cc.startedAt,
      completedAt: cc.completedAt,
      totalEntries: total,
      countedEntries: counted,
      varianceCount: withVariance,
      progress: total > 0 ? Math.round((counted / total) * 100) : 0,
    };
  });

  return NextResponse.json({ cycleCounts: formatted });
}

// POST - Create a new cycle count
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();
  const { name, filterType, filterValue, notes } = body;

  if (!name?.trim())
    return NextResponse.json({ error: "Name is required" }, { status: 400 });

  // Build filter for which items to include
  const itemWhere: any = {};
  if (filterType && filterValue) {
    switch (filterType) {
      case "zone": itemWhere.zone = filterValue; break;
      case "aisle": itemWhere.aisle = filterValue; break;
      case "row": itemWhere.row = filterValue; break;
      case "bin": itemWhere.bin = filterValue; break;
      case "category": itemWhere.category = filterValue; break;
      case "all": break;
      default: break;
    }
  }

  const items = await prisma.inventoryItem.findMany({ where: itemWhere });

  if (items.length === 0)
    return NextResponse.json({ error: "No items match the selected filter" }, { status: 400 });

  const cycleCount = await prisma.cycleCount.create({
    data: {
      name,
      filterType: filterType || "all",
      filterValue: filterValue || null,
      notes: notes || null,
      createdById: userId,
      entries: {
        create: items.map(item => ({
          inventoryItemId: item.id,
          expectedQty: item.quantity,
        })),
      },
    },
    include: { _count: { select: { entries: true } } },
  });

  return NextResponse.json({ cycleCount });
}

// PUT - Update cycle count status or update an entry
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();

  // Update a cycle count entry (record a count)
  if (body.entryId) {
    const { entryId, countedQty, adjustmentReason, skip } = body;

    const entry = await prisma.cycleCountEntry.findUnique({
      where: { id: entryId },
      include: { cycleCount: true },
    });

    if (!entry)
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    if (skip) {
      const updated = await prisma.cycleCountEntry.update({
        where: { id: entryId },
        data: { status: "SKIPPED" },
      });
      return NextResponse.json({ entry: updated });
    }

    const counted = parseInt(countedQty);
    if (isNaN(counted) || counted < 0)
      return NextResponse.json({ error: "Invalid count" }, { status: 400 });

    const variance = counted - entry.expectedQty;

    const updated = await prisma.cycleCountEntry.update({
      where: { id: entryId },
      data: {
        countedQty: counted,
        variance,
        status: "COUNTED",
        countedById: userId,
        adjustmentReason: adjustmentReason || null,
        countedAt: new Date(),
      },
      include: { inventoryItem: true },
    });

    // Auto-update cycle count status to IN_PROGRESS if it was NOT_STARTED
    if (entry.cycleCount.status === "NOT_STARTED") {
      await prisma.cycleCount.update({
        where: { id: entry.cycleCountId },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });
    }

    return NextResponse.json({ entry: updated });
  }

  // Update cycle count status (complete, reconcile, void)
  if (body.cycleCountId && body.status) {
    const { cycleCountId, status } = body;

    const validTransitions: Record<string, string[]> = {
      NOT_STARTED: ["IN_PROGRESS", "VOIDED"],
      IN_PROGRESS: ["COUNTED", "VOIDED"],
      COUNTED: ["RECONCILED", "VOIDED"],
      RECONCILED: [],
      VOIDED: [],
    };

    const current = await prisma.cycleCount.findUnique({ where: { id: cycleCountId } });
    if (!current)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!validTransitions[current.status]?.includes(status))
      return NextResponse.json({ error: `Cannot transition from ${current.status} to ${status}` }, { status: 400 });

    const updateData: any = { status };
    if (status === "COUNTED" || status === "RECONCILED") {
      updateData.completedAt = new Date();
    }

    // If reconciling, apply the counted quantities to inventory
    if (status === "RECONCILED") {
      const entries = await prisma.cycleCountEntry.findMany({
        where: { cycleCountId, status: "COUNTED", variance: { not: 0 } },
        include: { inventoryItem: true },
      });

      for (const entry of entries) {
        if (entry.countedQty !== null) {
          await prisma.inventoryItem.update({
            where: { id: entry.inventoryItemId },
            data: { quantity: entry.countedQty },
          });

          await prisma.scanLog.create({
            data: {
              barcode: entry.inventoryItem.barcode,
              action: "AUDITED",
              quantityChange: entry.variance || 0,
              notes: `Cycle count reconciliation: ${current.name}. Expected: ${entry.expectedQty}, Counted: ${entry.countedQty}. ${entry.adjustmentReason || ""}`,
              scannedById: userId,
              inventoryItemId: entry.inventoryItemId,
            },
          });
        }
      }
    }

    const updated = await prisma.cycleCount.update({
      where: { id: cycleCountId },
      data: updateData,
    });

    return NextResponse.json({ cycleCount: updated });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

// DELETE - Delete a cycle count (only if NOT_STARTED or VOIDED)
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const cc = await prisma.cycleCount.findUnique({ where: { id } });
  if (!cc)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!["NOT_STARTED", "VOIDED"].includes(cc.status))
    return NextResponse.json({ error: "Can only delete counts that are Not Started or Voided" }, { status: 400 });

  await prisma.cycleCount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

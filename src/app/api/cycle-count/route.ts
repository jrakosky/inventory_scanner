import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

async function generateDocumentNumber(): Promise<string> {
  const count = await prisma.cycleCount.count();
  return `ICC-${String(count + 1).padStart(6, "0")}`;
}

function toDecimalString(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (isNaN(n) || n < 0) return null;
  return n.toFixed(2);
}

function variance(counted: Prisma.Decimal | null, onHand: Prisma.Decimal | null): number {
  if (!counted || !onHand) return 0;
  return counted.toNumber() - onHand.toNumber();
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const state = searchParams.get("state");
  const warehouseId = searchParams.get("warehouseId");

  if (id) {
    const cycleCount = await prisma.cycleCount.findUnique({
      where: { id },
      include: {
        warehouse: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
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

    const lines = cycleCount.entries;
    const linesInCount = lines.filter(l => l.lineCountStatus === "counted").length;
    const linesSkipped = lines.filter(l => l.lineCountStatus === "skipped").length;
    const linesPending = lines.filter(l => l.lineCountStatus === "notCounted" || l.lineCountStatus === "inProgress").length;
    const linesWithVariance = lines.filter(l =>
      l.lineCountStatus === "counted" && variance(l.counted, l.onHand) !== 0
    ).length;

    return NextResponse.json({
      ...cycleCount,
      summary: {
        totalLines: lines.length,
        linesInCount,
        linesSkipped,
        linesPending,
        linesWithVariance,
      },
    });
  }

  const where: Prisma.CycleCountWhereInput = {};
  if (state) where.state = state as Prisma.CycleCountWhereInput["state"];
  if (warehouseId) where.warehouseId = warehouseId;

  const cycleCounts = await prisma.cycleCount.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      warehouse: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
      entries: { select: { lineCountStatus: true, counted: true, onHand: true } },
    },
  });

  const formatted = cycleCounts.map(cc => {
    const totalLines = cc.entries.length;
    const linesInCount = cc.entries.filter(e => e.lineCountStatus === "counted").length;
    const linesWithVariance = cc.entries.filter(e =>
      e.lineCountStatus === "counted" && variance(e.counted, e.onHand) !== 0
    ).length;
    return {
      id: cc.id,
      documentNumber: cc.documentNumber,
      description: cc.description,
      state: cc.state,
      warehouse: cc.warehouse,
      assignedTo: cc.assignedTo,
      createdBy: cc.createdBy,
      createdAt: cc.createdAt,
      startDate: cc.startDate,
      endDate: cc.endDate,
      totalLines,
      linesInCount,
      linesWithVariance,
      progress: totalLines > 0 ? Math.round((linesInCount / totalLines) * 100) : 0,
    };
  });

  return NextResponse.json({ cycleCounts: formatted });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();
  const {
    description,
    warehouseId,
    assignedToId,
    itemFilter,
    itemIds,
    excludedAllocatedQuantity,
    showQuantityOnHand,
  } = body;

  if (!description?.trim())
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  if (!warehouseId)
    return NextResponse.json({ error: "Warehouse is required" }, { status: 400 });
  if (!assignedToId)
    return NextResponse.json({ error: "Assignee is required" }, { status: 400 });

  const [warehouse, assignee] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: warehouseId } }),
    prisma.user.findUnique({ where: { id: assignedToId } }),
  ]);
  if (!warehouse)
    return NextResponse.json({ error: "Warehouse not found" }, { status: 400 });
  if (!assignee)
    return NextResponse.json({ error: "Assignee not found" }, { status: 400 });

  let items;
  if (Array.isArray(itemIds) && itemIds.length > 0) {
    items = await prisma.inventoryItem.findMany({ where: { id: { in: itemIds } } });
  } else {
    const itemWhere: Prisma.InventoryItemWhereInput = {};
    if (itemFilter?.type && itemFilter.type !== "all" && itemFilter.value) {
      if (itemFilter.type === "zone") itemWhere.zone = itemFilter.value;
      else if (itemFilter.type === "aisle") itemWhere.aisle = itemFilter.value;
      else if (itemFilter.type === "category") itemWhere.category = itemFilter.value;
    }
    items = await prisma.inventoryItem.findMany({ where: itemWhere });
  }

  if (items.length === 0)
    return NextResponse.json({ error: "No items match the selected filter" }, { status: 400 });

  const documentNumber = await generateDocumentNumber();

  const cycleCount = await prisma.cycleCount.create({
    data: {
      documentNumber,
      description: description.trim(),
      warehouseId,
      assignedToId,
      createdById: userId,
      excludedAllocatedQuantity: !!excludedAllocatedQuantity,
      showQuantityOnHand: !!showQuantityOnHand,
      entries: {
        create: items.map(item => ({
          inventoryItemId: item.id,
          bin: item.bin,
          aisle: item.aisle,
          zone: item.zone,
          row: item.row,
          unitCost: item.costPrice,
        })),
      },
    },
    include: {
      warehouse: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      _count: { select: { entries: true } },
    },
  });

  return NextResponse.json({ cycleCount });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();

  if (body.entryId) {
    const { entryId, counted, damaged, adjustmentReason, skip } = body;

    const entry = await prisma.cycleCountEntry.findUnique({
      where: { id: entryId },
      include: { cycleCount: true },
    });
    if (!entry)
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    if (!["notStarted", "inProgress"].includes(entry.cycleCount.state))
      return NextResponse.json({ error: "Cycle count is not active" }, { status: 400 });

    if (skip) {
      const updated = await prisma.cycleCountEntry.update({
        where: { id: entryId },
        data: { lineCountStatus: "skipped" },
      });
      await autoStart(entry.cycleCountId, entry.cycleCount.state);
      return NextResponse.json({ entry: updated });
    }

    const countedStr = toDecimalString(counted);
    const damagedStr = toDecimalString(damaged);

    if (countedStr === null)
      return NextResponse.json({ error: "Invalid counted quantity" }, { status: 400 });

    const updated = await prisma.cycleCountEntry.update({
      where: { id: entryId },
      data: {
        counted: countedStr,
        damaged: damagedStr,
        lineCountStatus: "counted",
        countedById: userId,
        adjustmentReason: adjustmentReason?.trim() || null,
        countedAt: new Date(),
      },
      include: { inventoryItem: true },
    });

    await autoStart(entry.cycleCountId, entry.cycleCount.state);

    return NextResponse.json({ entry: updated });
  }

  if (body.cycleCountId && body.state) {
    const { cycleCountId, state } = body;

    const validTransitions: Record<string, string[]> = {
      notStarted: ["inProgress", "voided"],
      inProgress: ["counted", "voided"],
      counted: [],
      voided: [],
    };

    const current = await prisma.cycleCount.findUnique({ where: { id: cycleCountId } });
    if (!current)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!validTransitions[current.state]?.includes(state))
      return NextResponse.json({ error: `Cannot transition from ${current.state} to ${state}` }, { status: 400 });

    const updateData: Prisma.CycleCountUpdateInput = { state };
    const now = new Date();

    if (state === "inProgress") {
      updateData.startDate = now;
      await snapshotOnHand(cycleCountId);
    }
    if (state === "counted") {
      updateData.endDate = now;
      await snapshotOnHandAtEnd(cycleCountId);
    }

    const updated = await prisma.cycleCount.update({
      where: { id: cycleCountId },
      data: updateData,
    });

    return NextResponse.json({ cycleCount: updated });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

async function autoStart(cycleCountId: string, currentState: string) {
  if (currentState !== "notStarted") return;
  await prisma.cycleCount.update({
    where: { id: cycleCountId },
    data: { state: "inProgress", startDate: new Date() },
  });
  await snapshotOnHand(cycleCountId);
}

async function snapshotOnHand(cycleCountId: string) {
  const entries = await prisma.cycleCountEntry.findMany({
    where: { cycleCountId, onHand: null },
    include: { inventoryItem: { select: { quantity: true } } },
  });
  for (const e of entries) {
    await prisma.cycleCountEntry.update({
      where: { id: e.id },
      data: { onHand: e.inventoryItem.quantity.toFixed(2) },
    });
  }
}

async function snapshotOnHandAtEnd(cycleCountId: string) {
  const entries = await prisma.cycleCountEntry.findMany({
    where: { cycleCountId },
    include: { inventoryItem: { select: { quantity: true } } },
  });
  for (const e of entries) {
    await prisma.cycleCountEntry.update({
      where: { id: e.id },
      data: { onHandAtEnd: e.inventoryItem.quantity.toFixed(2) },
    });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const cc = await prisma.cycleCount.findUnique({ where: { id } });
  if (!cc)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!["notStarted", "voided"].includes(cc.state))
    return NextResponse.json({ error: "Can only delete counts that are Not Started or Voided" }, { status: 400 });

  await prisma.cycleCount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

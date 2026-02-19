import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const body = await req.json();
  const { barcode, action, item, quantityChange, notes } = body;

  if (!barcode) {
    return NextResponse.json({ error: "Barcode is required" }, { status: 400 });
  }

  try {
    if (action === "CREATE") {
      // Create new inventory item
      const newItem = await prisma.inventoryItem.create({
        data: {
          barcode,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity || 1,
          bin: item.bin || null,
          row: item.row || null,
          aisle: item.aisle || null,
          zone: item.zone || null,
          unit: item.unit || null,
          category: item.category || null,
          condition: item.condition || "GOOD",
          createdById: userId,
        },
      });

      // Log the scan
      await prisma.scanLog.create({
        data: {
          barcode,
          action: "CREATED",
          quantityChange: item.quantity || 1,
          notes: notes || null,
          scannedById: userId,
          inventoryItemId: newItem.id,
        },
      });

      return NextResponse.json({ item: newItem, action: "created" });
    }

    if (action === "INCREMENT") {
      // Find and update existing item
      const existing = await prisma.inventoryItem.findUnique({
        where: { barcode },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Item not found" },
          { status: 404 }
        );
      }

      const qty = quantityChange || 1;

      const updated = await prisma.inventoryItem.update({
        where: { barcode },
        data: { quantity: { increment: qty } },
      });

      // Log the scan
      await prisma.scanLog.create({
        data: {
          barcode,
          action: "INCREMENTED",
          quantityChange: qty,
          notes: notes || null,
          scannedById: userId,
          inventoryItemId: existing.id,
        },
      });

      return NextResponse.json({ item: updated, action: "incremented" });
    }

    if (action === "DECREMENT") {
      const existing = await prisma.inventoryItem.findUnique({
        where: { barcode },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Item not found" },
          { status: 404 }
        );
      }

      const qty = Math.abs(quantityChange || 1);
      const newQuantity = Math.max(0, existing.quantity - qty);

      const updated = await prisma.inventoryItem.update({
        where: { barcode },
        data: { quantity: newQuantity },
      });

      await prisma.scanLog.create({
        data: {
          barcode,
          action: "DECREMENTED",
          quantityChange: -qty,
          notes: notes || null,
          scannedById: userId,
          inventoryItemId: existing.id,
        },
      });

      return NextResponse.json({ item: updated, action: "decremented" });
    }

    if (action === "AUDIT") {
      const existing = await prisma.inventoryItem.findUnique({
        where: { barcode },
      });

      await prisma.scanLog.create({
        data: {
          barcode,
          action: "AUDITED",
          notes: notes || null,
          scannedById: userId,
          inventoryItemId: existing?.id || null,
        },
      });

      return NextResponse.json({ action: "audited" });
    }

    return NextResponse.json(
      { error: "Invalid action. Use CREATE, INCREMENT, DECREMENT, or AUDIT" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Scan error:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "An item with this barcode already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET scan logs
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get("barcode");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: any = {};
  if (barcode) where.barcode = barcode;

  const logs = await prisma.scanLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
    include: {
      scannedBy: { select: { name: true, email: true } },
      inventoryItem: { select: { name: true } },
    },
  });

  return NextResponse.json({ logs });
}

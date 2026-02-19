import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get("barcode");
  const search = searchParams.get("search");
  const category = searchParams.get("category");
  const stats = searchParams.get("stats");

  // Single item lookup by barcode
  if (barcode) {
    const item = await prisma.inventoryItem.findUnique({
      where: { barcode },
    });
    return NextResponse.json({ item });
  }

  // Dashboard stats
  if (stats === "true") {
    const [totalItems, totalQuantity, lowStockCount, recentScans, recentActivity] =
      await Promise.all([
        prisma.inventoryItem.count(),
        prisma.inventoryItem.aggregate({ _sum: { quantity: true } }),
        prisma.inventoryItem.count({
          where: {
            AND: [
              { minStock: { gt: 0 } },
              {
                quantity: {
                  lte: prisma.inventoryItem.fields.minStock as any,
                },
              },
            ],
          },
        }).catch(() => 0), // Fallback if complex query fails
        prisma.scanLog.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        prisma.scanLog.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { inventoryItem: { select: { name: true } } },
        }),
      ]);

    return NextResponse.json({
      totalItems,
      totalQuantity: totalQuantity._sum.quantity || 0,
      lowStockCount,
      recentScans,
      recentActivity: recentActivity.map((s) => ({
        id: s.id,
        barcode: s.barcode,
        action: s.action,
        itemName: s.inventoryItem?.name || "Unknown",
        createdAt: s.createdAt.toISOString(),
      })),
    });
  }

  // List items with search and filter
  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { barcode: { contains: search } },
      { description: { contains: search } },
    ];
  }
  if (category && category !== "all") {
    where.category = category;
  }

  const [items, categories] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.inventoryItem.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    }),
  ]);

  return NextResponse.json({
    items,
    categories: categories
      .map((c) => c.category)
      .filter(Boolean) as string[],
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...data } = body;

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      quantity: data.quantity,
      bin: data.bin,
      row: data.row,
      aisle: data.aisle,
      zone: data.zone,
      unit: data.unit,
      condition: data.condition,
    },
  });

  // Log the update
  await prisma.scanLog.create({
    data: {
      barcode: item.barcode,
      action: "UPDATED",
      scannedById: (session.user as any).id,
      inventoryItemId: item.id,
    },
  });

  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id)
    return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Delete scan logs first, then the item
  await prisma.scanLog.deleteMany({ where: { inventoryItemId: id } });
  await prisma.inventoryItem.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

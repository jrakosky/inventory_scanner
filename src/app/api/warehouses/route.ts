import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const warehouses = await prisma.warehouse.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ warehouses });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { name } = await req.json();
  if (!name?.trim())
    return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    const warehouse = await prisma.warehouse.create({
      data: { name: name.trim() },
    });
    return NextResponse.json({ warehouse });
  } catch (e: any) {
    if (e.code === "P2002")
      return NextResponse.json({ error: "A warehouse with that name already exists" }, { status: 409 });
    throw e;
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id, name, active } = await req.json();
  if (!id)
    return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const data: { name?: string; active?: boolean } = {};
  if (name !== undefined) data.name = name.trim();
  if (active !== undefined) data.active = !!active;

  try {
    const warehouse = await prisma.warehouse.update({ where: { id }, data });
    return NextResponse.json({ warehouse });
  } catch (e: any) {
    if (e.code === "P2002")
      return NextResponse.json({ error: "A warehouse with that name already exists" }, { status: 409 });
    throw e;
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const inUse = await prisma.cycleCount.count({ where: { warehouseId: id } });
  if (inUse > 0)
    return NextResponse.json(
      { error: "Warehouse is in use by cycle counts; deactivate instead." },
      { status: 400 }
    );

  await prisma.warehouse.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

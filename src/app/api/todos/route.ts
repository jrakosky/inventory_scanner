import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todos = await prisma.todo.findMany({
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ todos });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { title, description, priority } = await req.json();

  if (!title?.trim())
    return NextResponse.json({ error: "Title required" }, { status: 400 });

  const todo = await prisma.todo.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      priority: priority || "MEDIUM",
      createdById: userId,
    },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ todo });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, title, description, priority, status } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const data: any = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description?.trim() || null;
  if (priority !== undefined) data.priority = priority;
  if (status !== undefined) data.status = status;

  const todo = await prisma.todo.update({
    where: { id },
    data,
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ todo });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.todo.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

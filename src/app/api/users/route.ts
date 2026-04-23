import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

function validPassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= MIN_PASSWORD_LENGTH;
}

function validEmail(e: unknown): e is string {
  return typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { email, name, password, role } = await req.json();

  if (!validEmail(email))
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  if (!validPassword(password))
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  if (role && !["USER", "ADMIN"].includes(role))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  try {
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        hashedPassword: hashed,
        role: role || "USER",
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return NextResponse.json({ user });
  } catch (e: any) {
    if (e.code === "P2002")
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    throw e;
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id, name, role, password } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const data: { name?: string | null; role?: "USER" | "ADMIN"; hashedPassword?: string } = {};

  if (name !== undefined) data.name = name?.trim() || null;

  if (role !== undefined) {
    if (!["USER", "ADMIN"].includes(role))
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    if (role === "USER") {
      const target = await prisma.user.findUnique({ where: { id } });
      if (target?.role === "ADMIN") {
        const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
        if (adminCount <= 1)
          return NextResponse.json(
            { error: "Cannot demote the last admin" },
            { status: 400 }
          );
      }
    }
    data.role = role;
  }

  if (password !== undefined && password !== "") {
    if (!validPassword(password))
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        { status: 400 }
      );
    data.hashedPassword = await bcrypt.hash(password, 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user });
}

/**
 * Returns a map of how many records a user owns across each FK table.
 * Used to decide whether a delete needs a reassignment step.
 */
async function linkedRecordCounts(userId: string) {
  const [
    inventoryItems,
    scanLogs,
    cycleCountsCreated,
    cycleCountsAssigned,
    todos,
  ] = await Promise.all([
    prisma.inventoryItem.count({ where: { createdById: userId } }),
    prisma.scanLog.count({ where: { scannedById: userId } }),
    prisma.cycleCount.count({ where: { createdById: userId } }),
    prisma.cycleCount.count({ where: { assignedToId: userId } }),
    prisma.todo.count({ where: { createdById: userId } }),
  ]);
  return {
    inventoryItems,
    scanLogs,
    cycleCountsCreated,
    cycleCountsAssigned,
    todos,
    total:
      inventoryItems + scanLogs + cycleCountsCreated + cycleCountsAssigned + todos,
  };
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const reassignToId = url.searchParams.get("reassignToId");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const currentUserId = (session.user as any).id;
  if (id === currentUserId)
    return NextResponse.json({ error: "You can't delete yourself" }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1)
      return NextResponse.json(
        { error: "Cannot delete the last admin" },
        { status: 400 }
      );
  }

  const linked = await linkedRecordCounts(id);

  // No linked records → safe to delete outright.
  if (linked.total === 0) {
    try {
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ success: true });
    } catch (e: any) {
      if (e.code === "P2003")
        return NextResponse.json(
          {
            error:
              "Cannot delete — user has linked records. Refresh and try again with a reassign target.",
          },
          { status: 400 }
        );
      throw e;
    }
  }

  // Linked records exist. Caller must supply a user to inherit them.
  if (!reassignToId)
    return NextResponse.json(
      {
        error: "Reassignment required",
        code: "REASSIGN_REQUIRED",
        linked,
      },
      { status: 409 }
    );

  if (reassignToId === id)
    return NextResponse.json(
      { error: "Can't reassign records to the user being deleted" },
      { status: 400 }
    );

  const newOwner = await prisma.user.findUnique({ where: { id: reassignToId } });
  if (!newOwner)
    return NextResponse.json({ error: "Reassign target not found" }, { status: 400 });

  // Transfer required-FK records and delete atomically.
  await prisma.$transaction([
    prisma.inventoryItem.updateMany({
      where: { createdById: id },
      data: { createdById: reassignToId },
    }),
    prisma.scanLog.updateMany({
      where: { scannedById: id },
      data: { scannedById: reassignToId },
    }),
    prisma.cycleCount.updateMany({
      where: { createdById: id },
      data: { createdById: reassignToId },
    }),
    prisma.cycleCount.updateMany({
      where: { assignedToId: id },
      data: { assignedToId: reassignToId },
    }),
    prisma.todo.updateMany({
      where: { createdById: id },
      data: { createdById: reassignToId },
    }),
    // Nullable references — null out so the new owner doesn't inherit
    // counts/tokens they didn't actually perform/authorize.
    prisma.cycleCount.updateMany({
      where: { approvedById: id },
      data: { approvedById: null },
    }),
    prisma.cycleCountEntry.updateMany({
      where: { countedById: id },
      data: { countedById: null },
    }),
    prisma.intacctToken.updateMany({
      where: { connectedById: id },
      data: { connectedById: null },
    }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ success: true, reassignedTo: reassignToId });
}

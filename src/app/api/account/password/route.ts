import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id;
  const { currentPassword, newPassword } = await req.json();

  if (typeof currentPassword !== "string" || typeof newPassword !== "string")
    return NextResponse.json({ error: "Current and new password required" }, { status: 400 });

  if (newPassword.length < MIN_PASSWORD_LENGTH)
    return NextResponse.json(
      { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );

  if (currentPassword === newPassword)
    return NextResponse.json(
      { error: "New password must be different from current password" },
      { status: 400 }
    );

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const match = await bcrypt.compare(currentPassword, user.hashedPassword);
  if (!match)
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { hashedPassword: hashed },
  });

  return NextResponse.json({ success: true });
}

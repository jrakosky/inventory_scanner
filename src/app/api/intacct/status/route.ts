import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { intacctConfig } from "@/lib/intacct/config";
import { getStoredToken } from "@/lib/intacct/tokens";
import { listCycleCounts } from "@/lib/intacct/cycle-count";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!intacctConfig.isConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message: "OAuth credentials not set in environment",
    });
  }

  const token = await getStoredToken();
  if (!token) {
    return NextResponse.json({
      configured: true,
      connected: false,
      message: "Not connected — admin must authorize the app",
    });
  }

  try {
    const probe = await listCycleCounts();
    return NextResponse.json({
      configured: true,
      connected: true,
      message: "Connected",
      tokenExpiresAt: token.expiresAt,
      connectedAt: token.createdAt,
      cycleCountCount: probe["ia::meta"]?.totalCount ?? 0,
    });
  } catch (e) {
    return NextResponse.json({
      configured: true,
      connected: false,
      message: e instanceof Error ? e.message : "API call failed",
      tokenExpiresAt: token.expiresAt,
    });
  }
}

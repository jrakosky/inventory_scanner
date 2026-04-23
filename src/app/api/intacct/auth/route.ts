import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomBytes } from "crypto";
import { authOptions } from "@/lib/auth";
import { intacctConfig } from "@/lib/intacct/config";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  if (!intacctConfig.isConfigured()) {
    return NextResponse.json(
      { error: "Set INTACCT_CLIENT_ID, INTACCT_CLIENT_SECRET, INTACCT_REDIRECT_URI in .env" },
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString("hex");

  const url = new URL(intacctConfig.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", intacctConfig.clientId);
  url.searchParams.set("redirect_uri", intacctConfig.redirectUri);
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("intacct_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}

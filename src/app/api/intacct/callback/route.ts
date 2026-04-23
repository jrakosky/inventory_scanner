import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCodeForToken, saveTokenResponse } from "@/lib/intacct/tokens";

function redirectToSettings(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/settings", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.delete("intacct_oauth_state");
  return res;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return redirectToSettings(req, {
      intacct: "error",
      message: errorDescription || error,
    });
  }

  const expectedState = req.cookies.get("intacct_oauth_state")?.value;
  if (!state || !expectedState || state !== expectedState) {
    return redirectToSettings(req, {
      intacct: "error",
      message: "Invalid state parameter",
    });
  }

  if (!code) {
    return redirectToSettings(req, {
      intacct: "error",
      message: "Missing authorization code",
    });
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    await saveTokenResponse(tokens, (session.user as any).id);
    return redirectToSettings(req, { intacct: "connected" });
  } catch (e) {
    return redirectToSettings(req, {
      intacct: "error",
      message: e instanceof Error ? e.message : "Token exchange failed",
    });
  }
}

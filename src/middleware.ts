import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/**
 * Role-based route protection.
 *
 * /settings/* is ADMIN-only. Non-admins hitting it get bounced to /account,
 * which is their self-service equivalent.
 *
 * Deep API protection still happens inside each /api route handler — this
 * middleware is defense-in-depth for the UI pages.
 */
export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if ((token as any).role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/account";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/settings/:path*"],
};

import { prisma } from "@/lib/prisma";
import { intacctConfig } from "./config";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

const REFRESH_SKEW_MS = 60_000;

export async function exchangeCodeForToken(
  code: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: intacctConfig.redirectUri,
    client_id: intacctConfig.clientId,
    client_secret: intacctConfig.clientSecret,
  });

  const res = await fetch(intacctConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(
      `Token exchange failed: ${res.status} ${await res.text()}`
    );
  }

  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: intacctConfig.clientId,
    client_secret: intacctConfig.clientSecret,
  });

  const res = await fetch(intacctConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(
      `Token refresh failed: ${res.status} ${await res.text()}`
    );
  }

  return res.json();
}

export async function saveTokenResponse(
  tokens: TokenResponse,
  connectedById: string | null
) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.intacctToken.deleteMany({});
  await prisma.intacctToken.create({
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      tokenType: tokens.token_type || "Bearer",
      scope: tokens.scope || null,
      connectedById,
    },
  });
}

export async function getStoredToken() {
  return prisma.intacctToken.findFirst({
    orderBy: { createdAt: "desc" },
  });
}

export async function clearStoredTokens() {
  await prisma.intacctToken.deleteMany({});
}

export async function getValidAccessToken(): Promise<string> {
  const stored = await getStoredToken();
  if (!stored) throw new Error("Not connected to Sage Intacct");

  const expiringSoon =
    stored.expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;

  if (!expiringSoon) return stored.accessToken;

  const refreshed = await refreshAccessToken(stored.refreshToken);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await prisma.intacctToken.update({
    where: { id: stored.id },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt,
      tokenType: refreshed.token_type || "Bearer",
      scope: refreshed.scope || null,
    },
  });

  return refreshed.access_token;
}

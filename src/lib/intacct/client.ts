import { intacctConfig } from "./config";
import { getValidAccessToken, refreshAccessToken, getStoredToken, saveTokenResponse } from "./tokens";
import { prisma } from "@/lib/prisma";

export class IntacctApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function requestOnce(
  path: string,
  accessToken: string,
  init: RequestInit
): Promise<Response> {
  const url = `${intacctConfig.apiUrl}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

export async function intacctFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  if (!intacctConfig.isConfigured()) {
    throw new Error("Sage Intacct OAuth is not configured");
  }

  let accessToken = await getValidAccessToken();
  let res = await requestOnce(path, accessToken, init);

  if (res.status === 401) {
    const stored = await getStoredToken();
    if (!stored) throw new Error("Not connected to Sage Intacct");
    const refreshed = await refreshAccessToken(stored.refreshToken);
    await saveTokenResponse(refreshed, stored.connectedById);
    accessToken = refreshed.access_token;
    res = await requestOnce(path, accessToken, init);
  }

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new IntacctApiError(
      res.status,
      body,
      `Intacct ${init.method || "GET"} ${path} failed: ${res.status}`
    );
  }

  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export { prisma };

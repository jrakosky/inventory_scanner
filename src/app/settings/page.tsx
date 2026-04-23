"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Plug,
  User,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IntacctStatus {
  configured: boolean;
  connected: boolean;
  message: string;
  tokenExpiresAt?: string;
  connectedAt?: string;
  cycleCountCount?: number;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [sageStatus, setSageStatus] = useState<
    "idle" | "testing" | "connected" | "failed"
  >("idle");
  const [sageMessage, setSageMessage] = useState("");
  const [intacct, setIntacct] = useState<IntacctStatus | null>(null);
  const [intacctLoading, setIntacctLoading] = useState(true);
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const testSageConnection = async () => {
    setSageStatus("testing");
    try {
      const res = await fetch("/api/sage/sync?test=true");
      const data = await res.json();
      setSageStatus(data.connected ? "connected" : "failed");
      setSageMessage(data.message);
    } catch {
      setSageStatus("failed");
      setSageMessage("Network error");
    }
  };

  const fetchIntacctStatus = useCallback(async () => {
    setIntacctLoading(true);
    try {
      const res = await fetch("/api/intacct/status");
      const data = await res.json();
      setIntacct(data);
    } catch {
      setIntacct({
        configured: false,
        connected: false,
        message: "Failed to check status",
      });
    }
    setIntacctLoading(false);
  }, []);

  useEffect(() => {
    fetchIntacctStatus();
  }, [fetchIntacctStatus]);

  const intacctCallbackStatus = searchParams.get("intacct");
  const intacctCallbackMessage = searchParams.get("message");

  const handleDisconnect = async () => {
    if (!confirm("Disconnect from Sage Intacct? You'll need to re-authorize.")) return;
    await fetch("/api/intacct/disconnect", { method: "POST" });
    fetchIntacctStatus();
  };

  return (
    <div className="space-y-4">
      {/* User Card */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">
              {session?.user?.name || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">
              {session?.user?.email || "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge variant="secondary">
              {(session?.user as any)?.role || "USER"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Sage Intacct REST (OAuth) */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-primary" />
            Sage Intacct (REST)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {intacctCallbackStatus === "connected" && (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Successfully connected to Sage Intacct
            </div>
          )}
          {intacctCallbackStatus === "error" && (
            <div className="flex items-start gap-1.5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Connection failed: {intacctCallbackMessage || "Unknown error"}</span>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            One admin connects the app to Sage Intacct via OAuth 2.0. All users share this connection.
          </p>

          {intacctLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking status...
            </div>
          ) : intacct ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {intacct.connected ? (
                  <Badge className="bg-emerald-100 text-emerald-700">Connected</Badge>
                ) : intacct.configured ? (
                  <Badge variant="secondary">Not connected</Badge>
                ) : (
                  <Badge variant="outline">Not configured</Badge>
                )}
              </div>

              {intacct.connectedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Connected</span>
                  <span className="text-sm font-medium">
                    {new Date(intacct.connectedAt).toLocaleString()}
                  </span>
                </div>
              )}

              {intacct.tokenExpiresAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Token expires</span>
                  <span className="text-sm font-medium">
                    {new Date(intacct.tokenExpiresAt).toLocaleString()}
                  </span>
                </div>
              )}

              {typeof intacct.cycleCountCount === "number" && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cycle counts in Intacct</span>
                  <span className="text-sm font-medium">{intacct.cycleCountCount}</span>
                </div>
              )}

              {intacct.message && (
                <p className="text-xs text-muted-foreground">{intacct.message}</p>
              )}

              <div className="flex gap-2 pt-1">
                {intacct.connected ? (
                  isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnect}
                    >
                      <Unlink className="mr-2 h-3.5 w-3.5" />
                      Disconnect
                    </Button>
                  )
                ) : (
                  isAdmin && intacct.configured && (
                    <Button
                      size="sm"
                      onClick={() => (window.location.href = "/api/intacct/auth")}
                    >
                      <LinkIcon className="mr-2 h-3.5 w-3.5" />
                      Connect to Sage
                    </Button>
                  )
                )}
                {!isAdmin && !intacct.connected && (
                  <p className="text-xs text-muted-foreground">Admin must authorize the app.</p>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Sage Intacct XML Gateway (fallback) */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-muted-foreground" />
            Sage Intacct (XML Gateway — fallback)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Legacy XML API. Only used if the REST integration is unavailable.
          </p>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={testSageConnection}
              disabled={sageStatus === "testing"}
            >
              {sageStatus === "testing" && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Test Connection
            </Button>

            {sageStatus === "connected" && (
              <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Connected
              </div>
            )}
            {sageStatus === "failed" && (
              <div className="flex items-center gap-1.5 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                Failed
              </div>
            )}
          </div>

          {sageMessage && (
            <p className="text-xs text-muted-foreground">{sageMessage}</p>
          )}
        </CardContent>
      </Card>

      {/* Database */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            Database
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Engine</span>
            <Badge variant="outline">MariaDB</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">ORM</span>
            <Badge variant="outline">Prisma</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Scan History */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All scan events are logged with timestamps, user IDs, and action
            types. Access the full audit log via the API at{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              /api/scan?logs=true
            </code>
          </p>
        </CardContent>
      </Card>

      {/* App Info */}
      <div className="text-center text-xs text-muted-foreground">
        <p>InvScan v1.0.0</p>
        <p>Next.js + shadcn/ui + MariaDB + Prisma</p>
      </div>
    </div>
  );
}

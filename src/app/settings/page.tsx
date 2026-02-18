"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Plug,
  User,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [sageStatus, setSageStatus] = useState<
    "idle" | "testing" | "connected" | "failed"
  >("idle");
  const [sageMessage, setSageMessage] = useState("");

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

      {/* Sage Intacct Connection */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plug className="h-4 w-4 text-primary" />
            Sage Intacct
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Test your connection to Sage Intacct. Configure credentials in your
            environment variables.
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
              <div className="flex items-center gap-1.5 text-sm text-emerald-400">
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

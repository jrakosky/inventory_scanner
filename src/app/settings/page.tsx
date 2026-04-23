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
  Building2,
  Plus,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface Warehouse {
  id: string;
  name: string;
  active: boolean;
  intacctKey: string | null;
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
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [newWarehouseName, setNewWarehouseName] = useState("");
  const [warehouseError, setWarehouseError] = useState("");
  const [warehousesLoading, setWarehousesLoading] = useState(true);
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

  const fetchWarehouses = useCallback(async () => {
    setWarehousesLoading(true);
    try {
      const res = await fetch("/api/warehouses");
      const data = await res.json();
      setWarehouses(data.warehouses || []);
    } catch {}
    setWarehousesLoading(false);
  }, []);

  useEffect(() => {
    fetchIntacctStatus();
    fetchWarehouses();
  }, [fetchIntacctStatus, fetchWarehouses]);

  const intacctCallbackStatus = searchParams.get("intacct");
  const intacctCallbackMessage = searchParams.get("message");

  const handleCreateWarehouse = async () => {
    setWarehouseError("");
    if (!newWarehouseName.trim()) return;
    const res = await fetch("/api/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newWarehouseName }),
    });
    if (res.ok) {
      setNewWarehouseName("");
      fetchWarehouses();
    } else {
      const err = await res.json();
      setWarehouseError(err.error || "Failed to add warehouse");
    }
  };

  const handleToggleWarehouse = async (w: Warehouse) => {
    await fetch("/api/warehouses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: w.id, active: !w.active }),
    });
    fetchWarehouses();
  };

  const handleDeleteWarehouse = async (w: Warehouse) => {
    if (!confirm(`Delete warehouse "${w.name}"?`)) return;
    const res = await fetch(`/api/warehouses?id=${w.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Could not delete");
      return;
    }
    fetchWarehouses();
  };

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

      {/* Warehouses */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            Warehouses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Warehouses are required for cycle counts. They'll sync from Sage once connected — for now, add names that match what's in Sage.
          </p>

          {warehousesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="space-y-1">
              {warehouses.map(w => (
                <div key={w.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${!w.active ? "text-muted-foreground line-through" : ""}`}>
                      {w.name}
                    </p>
                    {w.intacctKey && (
                      <p className="text-xs text-muted-foreground">Intacct: {w.intacctKey}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!w.active && <Badge variant="outline" className="mr-2">Inactive</Badge>}
                    {isAdmin && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleWarehouse(w)}
                          title={w.active ? "Deactivate" : "Activate"}
                        >
                          {w.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteWarehouse(w)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {warehouses.length === 0 && (
                <p className="text-sm text-muted-foreground">No warehouses yet.</p>
              )}
            </div>
          )}

          {isAdmin && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newWarehouseName}
                  onChange={e => setNewWarehouseName(e.target.value)}
                  placeholder="New warehouse name"
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); handleCreateWarehouse(); }
                  }}
                />
                <Button onClick={handleCreateWarehouse} disabled={!newWarehouseName.trim()}>
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
              {warehouseError && (
                <p className="text-xs text-destructive">{warehouseError}</p>
              )}
            </div>
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

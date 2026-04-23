"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Building2,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Warehouse {
  id: string;
  name: string;
  active: boolean;
  intacctKey: string | null;
}

export default function WarehousesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/warehouses");
      const data = await res.json();
      setWarehouses(data.warehouses || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);

  const handleCreate = async () => {
    setError("");
    if (!newName.trim()) return;
    const res = await fetch("/api/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      setNewName("");
      fetchWarehouses();
    } else {
      const err = await res.json();
      setError(err.error || "Failed to add warehouse");
    }
  };

  const handleToggle = async (w: Warehouse) => {
    await fetch("/api/warehouses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: w.id, active: !w.active }),
    });
    fetchWarehouses();
  };

  const handleDelete = async (w: Warehouse) => {
    if (!confirm(`Delete warehouse "${w.name}"?`)) return;
    const res = await fetch(`/api/warehouses?id=${w.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Could not delete");
      return;
    }
    fetchWarehouses();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Warehouses</h2>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Warehouses are required for cycle counts. They'll sync from Sage once connected — for now, add names that match what's in Sage."
            : "Warehouses defined for cycle counts. Contact an admin to add or edit."}
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            All warehouses
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="space-y-1">
              {warehouses.map(w => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${
                        !w.active ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {w.name}
                    </p>
                    {w.intacctKey && (
                      <p className="text-xs text-muted-foreground">
                        Intacct: {w.intacctKey}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!w.active && (
                      <Badge variant="outline" className="mr-2">Inactive</Badge>
                    )}
                    {isAdmin && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggle(w)}
                          title={w.active ? "Deactivate" : "Activate"}
                        >
                          {w.active ? (
                            <PowerOff className="h-3.5 w-3.5" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(w)}
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
            <div className="space-y-2 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">Add warehouse</p>
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="New warehouse name"
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); handleCreate(); }
                  }}
                />
                <Button onClick={handleCreate} disabled={!newName.trim()}>
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Plus,
  Play,
  XCircle,
  Download,
  Trash2,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface CycleCountSummary {
  id: string;
  documentNumber: string;
  description: string;
  state: "notStarted" | "inProgress" | "counted" | "voided";
  warehouse: { id: string; name: string } | null;
  assignedTo: { id: string; name: string | null; email: string } | null;
  createdBy: { name: string | null; email: string };
  createdAt: string;
  startDate: string | null;
  endDate: string | null;
  totalLines: number;
  linesInCount: number;
  linesWithVariance: number;
  progress: number;
}

interface Warehouse { id: string; name: string; active: boolean; }
interface UserRef { id: string; name: string | null; email: string; role: string; }

const stateColors: Record<string, string> = {
  notStarted: "bg-gray-100 text-gray-700",
  inProgress: "bg-amber-100 text-amber-700",
  counted: "bg-blue-100 text-blue-700",
  voided: "bg-red-100 text-red-700",
};

const stateLabels: Record<string, string> = {
  notStarted: "Not started",
  inProgress: "In progress",
  counted: "Counted — awaiting Sage reconcile",
  voided: "Voided",
};

export default function CycleCountPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<CycleCountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [users, setUsers] = useState<UserRef[]>([]);

  const [newDescription, setNewDescription] = useState("");
  const [newWarehouseId, setNewWarehouseId] = useState("");
  const [newAssignedToId, setNewAssignedToId] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterValue, setFilterValue] = useState("");
  const [excludedAllocated, setExcludedAllocated] = useState(true);
  const [showQtyOnHand, setShowQtyOnHand] = useState(false);

  const [zones, setZones] = useState<string[]>([]);
  const [aisles, setAisles] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cycle-count");
      const data = await res.json();
      setCounts(data.cycleCounts || []);
    } catch {}
    setLoading(false);
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const [whRes, usersRes, invRes] = await Promise.all([
        fetch("/api/warehouses"),
        fetch("/api/users"),
        fetch("/api/inventory"),
      ]);
      const whData = await whRes.json();
      const usersData = await usersRes.json();
      const invData = await invRes.json();
      const activeWarehouses: Warehouse[] = (whData.warehouses || []).filter((w: Warehouse) => w.active);
      setWarehouses(activeWarehouses);
      setUsers(usersData.users || []);
      const items = invData.items || [];
      setZones(Array.from(new Set(items.map((i: any) => i.zone).filter(Boolean))) as string[]);
      setAisles(Array.from(new Set(items.map((i: any) => i.aisle).filter(Boolean))) as string[]);
      setCategories(invData.categories || []);
    } catch {}
  }, []);

  useEffect(() => { fetchCounts(); fetchMeta(); }, [fetchCounts, fetchMeta]);

  const resetCreateForm = () => {
    setNewDescription("");
    setNewWarehouseId("");
    setNewAssignedToId("");
    setFilterType("all");
    setFilterValue("");
    setExcludedAllocated(true);
    setShowQtyOnHand(false);
    setCreateError("");
  };

  const handleCreate = async () => {
    setCreateError("");
    if (!newDescription.trim() || !newWarehouseId || !newAssignedToId) {
      setCreateError("Description, warehouse, and assignee are all required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/cycle-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newDescription,
          warehouseId: newWarehouseId,
          assignedToId: newAssignedToId,
          itemFilter: { type: filterType, value: filterType === "all" ? undefined : filterValue },
          excludedAllocatedQuantity: excludedAllocated,
          showQuantityOnHand: showQtyOnHand,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        resetCreateForm();
        fetchCounts();
      } else {
        const err = await res.json();
        setCreateError(err.error || "Failed to create");
      }
    } catch {
      setCreateError("Network error");
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this cycle count?")) return;
    await fetch(`/api/cycle-count?id=${id}`, { method: "DELETE" });
    fetchCounts();
  };

  const handleVoid = async (id: string) => {
    if (!confirm("Void this cycle count? This cannot be undone.")) return;
    await fetch("/api/cycle-count", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleCountId: id, state: "voided" }),
    });
    fetchCounts();
  };

  const handleExport = (id: string) => {
    window.open(`/api/cycle-count/export-xlsx?id=${id}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Cycle counts</h2>
          <p className="text-sm text-muted-foreground">
            Count portions of inventory on a rotating schedule. Final reconciliation happens in Sage.
          </p>
        </div>
        <Button
          onClick={() => {
            resetCreateForm();
            if (warehouses[0]) setNewWarehouseId(warehouses[0].id);
            setShowCreate(true);
          }}
          disabled={warehouses.length === 0 || users.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          New count
        </Button>
      </div>

      {warehouses.length === 0 && !loading && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">No warehouses configured</p>
              <p className="text-xs text-muted-foreground">Add a warehouse in Settings before creating a count.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => router.push("/settings")}>
              Go to Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/30" />
          ))}
        </div>
      ) : counts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ClipboardCheck className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No cycle counts yet</p>
            <p className="text-sm text-muted-foreground">
              Create a new count to start auditing inventory
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {counts.map(cc => (
            <Card key={cc.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{cc.description}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stateColors[cc.state]}`}>
                        {stateLabels[cc.state]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono">{cc.documentNumber}</span>
                      {cc.warehouse && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {cc.warehouse.name}
                        </span>
                      )}
                      {cc.assignedTo && (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          {cc.assignedTo.name || cc.assignedTo.email}
                        </span>
                      )}
                      <span>{cc.totalLines} items</span>
                      <span>{new Date(cc.createdAt).toLocaleDateString()}</span>
                    </div>

                    {cc.state !== "notStarted" && cc.state !== "voided" && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>{cc.linesInCount}/{cc.totalLines} counted</span>
                          {cc.linesWithVariance > 0 && (
                            <span className="flex items-center text-amber-600">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              {cc.linesWithVariance} variances
                            </span>
                          )}
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${cc.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {(cc.state === "notStarted" || cc.state === "inProgress") && (
                      <Button size="sm" onClick={() => router.push(`/cycle-count/${cc.id}`)}>
                        {cc.state === "notStarted" ? (
                          <><Play className="mr-1 h-3 w-3" /> Start</>
                        ) : (
                          <><ArrowRight className="mr-1 h-3 w-3" /> Continue</>
                        )}
                      </Button>
                    )}
                    {cc.state === "counted" && (
                      <Button size="sm" onClick={() => router.push(`/cycle-count/${cc.id}`)}>
                        <BarChart3 className="mr-1 h-3 w-3" /> Review
                      </Button>
                    )}
                    {cc.state === "voided" && (
                      <Button size="sm" variant="outline" onClick={() => router.push(`/cycle-count/${cc.id}`)}>
                        View
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleExport(cc.id)}>
                      <Download className="h-3 w-3" />
                    </Button>
                    {(cc.state === "notStarted" || cc.state === "inProgress") && (
                      <Button size="sm" variant="outline" onClick={() => handleVoid(cc.id)}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    )}
                    {(cc.state === "notStarted" || cc.state === "voided") && (
                      <Button size="sm" variant="outline" onClick={() => handleDelete(cc.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New cycle count</DialogTitle>
            <DialogDescription>
              Create a count scoped to a warehouse and assigned to an employee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Description *</Label>
              <Input
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="e.g. Zone A damaged laptops"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Warehouse *</Label>
              <Select value={newWarehouseId} onValueChange={setNewWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assigned to *</Label>
              <Select value={newAssignedToId} onValueChange={setNewAssignedToId}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Filter items by</Label>
              <Select value={filterType} onValueChange={v => { setFilterType(v); setFilterValue(""); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All items</SelectItem>
                  <SelectItem value="zone">Zone</SelectItem>
                  <SelectItem value="aisle">Aisle</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filterType !== "all" && (
              <div className="space-y-2">
                <Label>Select {filterType}</Label>
                {filterType === "zone" && zones.length > 0 ? (
                  <Select value={filterValue} onValueChange={setFilterValue}>
                    <SelectTrigger><SelectValue placeholder={`Choose ${filterType}`} /></SelectTrigger>
                    <SelectContent>
                      {zones.map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : filterType === "aisle" && aisles.length > 0 ? (
                  <Select value={filterValue} onValueChange={setFilterValue}>
                    <SelectTrigger><SelectValue placeholder={`Choose ${filterType}`} /></SelectTrigger>
                    <SelectContent>
                      {aisles.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : filterType === "category" && categories.length > 0 ? (
                  <Select value={filterValue} onValueChange={setFilterValue}>
                    <SelectTrigger><SelectValue placeholder={`Choose ${filterType}`} /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={filterValue}
                    onChange={e => setFilterValue(e.target.value)}
                    placeholder={`Enter ${filterType} value`}
                  />
                )}
              </div>
            )}

            <div className="space-y-2 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={excludedAllocated}
                  onChange={e => setExcludedAllocated(e.target.checked)}
                />
                Exclude allocated quantity
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showQtyOnHand}
                  onChange={e => setShowQtyOnHand(e.target.checked)}
                />
                Show quantity on hand during count
              </label>
            </div>

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newDescription.trim() || !newWarehouseId || !newAssignedToId}
            >
              {creating ? "Creating..." : "Create count"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

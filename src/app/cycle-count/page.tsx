"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Plus,
  Play,
  CheckCircle2,
  XCircle,
  Download,
  Trash2,
  AlertTriangle,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface CycleCountSummary {
  id: string;
  name: string;
  status: string;
  filterType: string | null;
  filterValue: string | null;
  createdBy: { name: string | null; email: string };
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  totalEntries: number;
  countedEntries: number;
  varianceCount: number;
  progress: number;
}

const statusColors: Record<string, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  COUNTED: "bg-blue-100 text-blue-700",
  RECONCILED: "bg-emerald-100 text-emerald-700",
  VOIDED: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COUNTED: "Counted",
  RECONCILED: "Reconciled",
  VOIDED: "Voided",
};

export default function CycleCountPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<CycleCountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form
  const [newName, setNewName] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterValue, setFilterValue] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Available filter values from inventory
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

  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/inventory");
      const data = await res.json();
      const items = data.items || [];
      setZones([...new Set(items.map((i: any) => i.zone).filter(Boolean))] as string[]);
      setAisles([...new Set(items.map((i: any) => i.aisle).filter(Boolean))] as string[]);
      setCategories(data.categories || []);
    } catch {}
  }, []);

  useEffect(() => { fetchCounts(); fetchFilterOptions(); }, [fetchCounts, fetchFilterOptions]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/cycle-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          filterType,
          filterValue: filterType === "all" ? null : filterValue,
          notes: newNotes,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewName("");
        setFilterType("all");
        setFilterValue("");
        setNewNotes("");
        fetchCounts();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create");
      }
    } catch {}
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
      body: JSON.stringify({ cycleCountId: id, status: "VOIDED" }),
    });
    fetchCounts();
  };

  const handleExport = (id: string) => {
    window.open(`/api/cycle-count/export?id=${id}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Cycle Counts</h2>
          <p className="text-sm text-muted-foreground">
            Count portions of inventory on a rotating schedule
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Count
        </Button>
      </div>

      {/* Active Counts */}
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
                      <h3 className="font-semibold truncate">{cc.name}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[cc.status]}`}>
                        {statusLabels[cc.status]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{cc.totalEntries} items</span>
                      {cc.filterType && cc.filterType !== "all" && (
                        <span>Filter: {cc.filterType} = {cc.filterValue}</span>
                      )}
                      <span>{new Date(cc.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Progress bar */}
                    {cc.status !== "NOT_STARTED" && cc.status !== "VOIDED" && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span>{cc.countedEntries}/{cc.totalEntries} counted</span>
                          {cc.varianceCount > 0 && (
                            <span className="flex items-center text-amber-600">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              {cc.varianceCount} variances
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
                    {(cc.status === "NOT_STARTED" || cc.status === "IN_PROGRESS") && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/cycle-count/${cc.id}`)}
                      >
                        {cc.status === "NOT_STARTED" ? (
                          <><Play className="mr-1 h-3 w-3" /> Start</>
                        ) : (
                          <><ArrowRight className="mr-1 h-3 w-3" /> Continue</>
                        )}
                      </Button>
                    )}
                    {cc.status === "COUNTED" && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/cycle-count/${cc.id}`)}
                      >
                        <BarChart3 className="mr-1 h-3 w-3" /> Review
                      </Button>
                    )}
                    {cc.status === "RECONCILED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/cycle-count/${cc.id}`)}
                      >
                        View
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleExport(cc.id)}>
                      <Download className="h-3 w-3" />
                    </Button>
                    {(cc.status === "NOT_STARTED" || cc.status === "IN_PROGRESS") && (
                      <Button size="sm" variant="outline" onClick={() => handleVoid(cc.id)}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    )}
                    {(cc.status === "NOT_STARTED" || cc.status === "VOIDED") && (
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

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Cycle Count</DialogTitle>
            <DialogDescription>
              Select which inventory items to include in this count.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Count Name *</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Zone A - February 2026"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Filter Items By</Label>
              <Select value={filterType} onValueChange={v => { setFilterType(v); setFilterValue(""); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Items</SelectItem>
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

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="Any notes about this count..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? "Creating..." : "Create Count"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

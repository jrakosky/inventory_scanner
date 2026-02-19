"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Check,
  SkipForward,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Package,
  Hash,
  ChevronDown,
  ChevronUp,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface CycleCountEntry {
  id: string;
  expectedQty: number;
  countedQty: number | null;
  variance: number | null;
  status: string;
  adjustmentReason: string | null;
  countedAt: string | null;
  inventoryItem: {
    id: string;
    barcode: string;
    name: string;
    bin: string | null;
    row: string | null;
    aisle: string | null;
    zone: string | null;
    unit: string | null;
  };
  countedBy: { name: string | null; email: string } | null;
}

interface CycleCountDetail {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  entries: CycleCountEntry[];
  summary: {
    totalEntries: number;
    countedEntries: number;
    skippedEntries: number;
    pendingEntries: number;
    varianceCount: number;
    totalVariance: number;
  };
}

export default function CycleCountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<CycleCountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanValue, setScanValue] = useState("");
  const [activeEntry, setActiveEntry] = useState<CycleCountEntry | null>(null);
  const [countValue, setCountValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "counted" | "variance">("all");
  const scanInputRef = useRef<HTMLInputElement>(null);
  const countInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/cycle-count?id=${id}`);
      const json = await res.json();
      setData(json);
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-focus scan input
  useEffect(() => {
    if (!activeEntry) {
      setTimeout(() => scanInputRef.current?.focus(), 300);
    }
  }, [activeEntry, data]);

  const handleScan = (barcode: string) => {
    if (!barcode.trim() || !data) return;
    const entry = data.entries.find(
      e => e.inventoryItem.barcode === barcode && e.status === "PENDING"
    );
    if (!entry) {
      // Check if it exists but already counted
      const counted = data.entries.find(e => e.inventoryItem.barcode === barcode);
      if (counted) {
        alert(`"${counted.inventoryItem.name}" has already been counted in this cycle.`);
      } else {
        alert(`Barcode "${barcode}" is not part of this cycle count.`);
      }
      setScanValue("");
      return;
    }
    setActiveEntry(entry);
    setCountValue("");
    setReason("");
    setScanValue("");
    setTimeout(() => countInputRef.current?.focus(), 300);
  };

  const handleCount = async () => {
    if (!activeEntry) return;
    const counted = parseInt(countValue);
    if (isNaN(counted) || counted < 0) return;
    setSaving(true);
    try {
      await fetch("/api/cycle-count", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: activeEntry.id,
          countedQty: counted,
          adjustmentReason: reason || null,
        }),
      });
      setActiveEntry(null);
      fetchData();
    } catch {}
    setSaving(false);
  };

  const handleSkip = async () => {
    if (!activeEntry) return;
    setSaving(true);
    try {
      await fetch("/api/cycle-count", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: activeEntry.id, skip: true }),
      });
      setActiveEntry(null);
      fetchData();
    } catch {}
    setSaving(false);
  };

  const handleMarkCounted = async () => {
    try {
      await fetch("/api/cycle-count", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleCountId: id, status: "COUNTED" }),
      });
      setShowComplete(false);
      fetchData();
    } catch {}
  };

  const handleReconcile = async () => {
    try {
      await fetch("/api/cycle-count", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleCountId: id, status: "RECONCILED" }),
      });
      setShowReconcile(false);
      fetchData();
    } catch {}
  };

  const filteredEntries = data?.entries.filter(e => {
    if (filter === "pending") return e.status === "PENDING";
    if (filter === "counted") return e.status === "COUNTED";
    if (filter === "variance") return e.status === "COUNTED" && e.variance !== 0;
    return true;
  }) || [];

  if (loading) return <div className="flex justify-center py-12"><p>Loading...</p></div>;
  if (!data) return <div className="flex justify-center py-12"><p>Count not found</p></div>;

  const isActive = data.status === "NOT_STARTED" || data.status === "IN_PROGRESS";
  const isCounted = data.status === "COUNTED";
  const isReconciled = data.status === "RECONCILED";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.push("/cycle-count")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{data.name}</h2>
          <p className="text-xs text-muted-foreground">
            {data.summary.countedEntries}/{data.summary.totalEntries} counted
            {data.summary.varianceCount > 0 && ` \u00b7 ${data.summary.varianceCount} variances`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.open(`/api/cycle-count/export?id=${id}`, "_blank")}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress */}
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${data.summary.totalEntries > 0 ? Math.round((data.summary.countedEntries / data.summary.totalEntries) * 100) : 0}%` }}
        />
      </div>

      {/* Scanner Input - only show when active */}
      {isActive && !activeEntry && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <form onSubmit={e => { e.preventDefault(); handleScan(scanValue); }} className="space-y-2">
              <Label className="text-xs text-muted-foreground">Scan or enter Item ID to count</Label>
              <div className="flex gap-2">
                <Input
                  ref={scanInputRef}
                  value={scanValue}
                  onChange={e => setScanValue(e.target.value)}
                  placeholder="Scan barcode..."
                  className="flex-1 text-lg font-mono"
                  autoFocus
                />
                <Button type="submit">
                  <Hash className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Active Count Entry */}
      {activeEntry && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{activeEntry.inventoryItem.name}</h3>
              <p className="text-sm font-mono text-muted-foreground">{activeEntry.inventoryItem.barcode}</p>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {activeEntry.inventoryItem.zone && <span>Zone: {activeEntry.inventoryItem.zone}</span>}
                {activeEntry.inventoryItem.aisle && <span>Aisle: {activeEntry.inventoryItem.aisle}</span>}
                {activeEntry.inventoryItem.row && <span>Row: {activeEntry.inventoryItem.row}</span>}
                {activeEntry.inventoryItem.bin && <span>Bin: {activeEntry.inventoryItem.bin}</span>}
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">System expects</p>
              <p className="text-3xl font-bold font-mono">{activeEntry.expectedQty}</p>
              <p className="text-xs text-muted-foreground">{activeEntry.inventoryItem.unit || "units"}</p>
            </div>

            <div className="space-y-2">
              <Label>Actual Count *</Label>
              <Input
                ref={countInputRef}
                type="number"
                min={0}
                value={countValue}
                onChange={e => setCountValue(e.target.value)}
                placeholder="Enter counted quantity"
                className="text-lg font-mono text-center"
                autoFocus
              />
            </div>

            {countValue !== "" && parseInt(countValue) !== activeEntry.expectedQty && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Variance: {parseInt(countValue) - activeEntry.expectedQty > 0 ? "+" : ""}
                    {parseInt(countValue) - activeEntry.expectedQty}
                  </span>
                </div>
                <Label>Reason for variance (optional)</Label>
                <Input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. damaged, missing, found extra"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleSkip} disabled={saving}>
                <SkipForward className="mr-1 h-4 w-4" /> Skip
              </Button>
              <Button
                className="flex-1"
                onClick={handleCount}
                disabled={saving || countValue === ""}
              >
                <Check className="mr-1 h-4 w-4" />
                {saving ? "Saving..." : "Record Count"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {isActive && data.summary.countedEntries > 0 && data.summary.pendingEntries === 0 && (
        <Button className="w-full" onClick={() => setShowComplete(true)}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Mark as Counted
        </Button>
      )}
      {isCounted && (
        <Button className="w-full" onClick={() => setShowReconcile(true)}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Reconcile & Apply Adjustments
        </Button>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(["all", "pending", "counted", "variance"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? `All (${data.entries.length})` :
             f === "pending" ? `Pending (${data.summary.pendingEntries})` :
             f === "counted" ? `Counted (${data.summary.countedEntries})` :
             `Variance (${data.summary.varianceCount})`}
          </button>
        ))}
      </div>

      {/* Entry List */}
      <div className="space-y-2">
        {filteredEntries.map(entry => (
          <div
            key={entry.id}
            className={`flex items-center gap-3 rounded-lg border p-3 ${
              entry.status === "COUNTED" && entry.variance !== 0
                ? "border-amber-200 bg-amber-50"
                : entry.status === "COUNTED"
                ? "border-emerald-200 bg-emerald-50"
                : entry.status === "SKIPPED"
                ? "border-gray-200 bg-gray-50 opacity-60"
                : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{entry.inventoryItem.name}</p>
              <p className="text-xs font-mono text-muted-foreground">{entry.inventoryItem.barcode}</p>
              {entry.inventoryItem.bin && (
                <p className="text-xs text-muted-foreground">
                  {[entry.inventoryItem.zone, entry.inventoryItem.aisle, entry.inventoryItem.row, entry.inventoryItem.bin].filter(Boolean).join(" \u2192 ")}
                </p>
              )}
            </div>
            <div className="text-right shrink-0">
              {entry.status === "COUNTED" ? (
                <div>
                  <span className="text-sm font-mono font-bold">{entry.countedQty}</span>
                  <span className="text-xs text-muted-foreground"> / {entry.expectedQty}</span>
                  {entry.variance !== 0 && (
                    <p className={`text-xs font-medium ${(entry.variance || 0) > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {(entry.variance || 0) > 0 ? "+" : ""}{entry.variance}
                    </p>
                  )}
                </div>
              ) : entry.status === "SKIPPED" ? (
                <Badge variant="outline">Skipped</Badge>
              ) : (
                <div>
                  <span className="text-sm font-mono text-muted-foreground">{entry.expectedQty} expected</span>
                  {isActive && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-2"
                      onClick={() => {
                        setActiveEntry(entry);
                        setCountValue("");
                        setReason("");
                        setTimeout(() => countInputRef.current?.focus(), 300);
                      }}
                    >
                      Count
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mark Counted Dialog */}
      <Dialog open={showComplete} onOpenChange={setShowComplete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Counted</DialogTitle>
            <DialogDescription>
              All items have been counted. Mark this cycle count as complete?
              You can still review and reconcile variances after this step.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplete(false)}>Cancel</Button>
            <Button onClick={handleMarkCounted}>Mark as Counted</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reconcile Dialog */}
      <Dialog open={showReconcile} onOpenChange={setShowReconcile}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconcile Inventory</DialogTitle>
            <DialogDescription>
              This will update inventory quantities to match the counted amounts.
              {data.summary.varianceCount > 0 && (
                <span className="block mt-2 font-medium text-amber-600">
                  {data.summary.varianceCount} items have variances that will be adjusted.
                </span>
              )}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReconcile(false)}>Cancel</Button>
            <Button onClick={handleReconcile}>Reconcile & Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

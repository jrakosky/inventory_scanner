"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Check,
  SkipForward,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Hash,
  Download,
  Building2,
  User as UserIcon,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type CycleCountState = "notStarted" | "inProgress" | "counted" | "voided";
type LineCountStatus = "notCounted" | "inProgress" | "skipped" | "counted";

interface CycleCountEntry {
  id: string;
  onHand: string | null;
  counted: string | null;
  damaged: string | null;
  onHandAtEnd: string | null;
  lineCountStatus: LineCountStatus;
  adjustmentReason: string | null;
  countedAt: string | null;
  bin: string | null;
  aisle: string | null;
  zone: string | null;
  row: string | null;
  serialNumber: string | null;
  lotNumber: string | null;
  inventoryItem: {
    id: string;
    barcode: string;
    name: string;
    quantity: number;
    unit: string | null;
  };
  countedBy: { name: string | null; email: string } | null;
}

interface CycleCountDetail {
  id: string;
  documentNumber: string;
  description: string;
  state: CycleCountState;
  showQuantityOnHand: boolean;
  excludedAllocatedQuantity: boolean;
  warehouse: { id: string; name: string } | null;
  assignedTo: { id: string; name: string | null; email: string } | null;
  entries: CycleCountEntry[];
  summary: {
    totalLines: number;
    linesInCount: number;
    linesSkipped: number;
    linesPending: number;
    linesWithVariance: number;
  };
}

const stateColors: Record<CycleCountState, string> = {
  notStarted: "bg-gray-100 text-gray-700",
  inProgress: "bg-amber-100 text-amber-700",
  counted: "bg-blue-100 text-blue-700",
  voided: "bg-red-100 text-red-700",
};

const stateLabels: Record<CycleCountState, string> = {
  notStarted: "Not started",
  inProgress: "In progress",
  counted: "Counted",
  voided: "Voided",
};

function lineVariance(entry: CycleCountEntry): number | null {
  if (entry.counted === null || entry.onHand === null) return null;
  return parseFloat(entry.counted) - parseFloat(entry.onHand);
}

export default function CycleCountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<CycleCountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState("");
  const [activeEntry, setActiveEntry] = useState<CycleCountEntry | null>(null);
  const [countValue, setCountValue] = useState("");
  const [damagedValue, setDamagedValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "counted" | "variance" | "skipped">("all");
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

  useEffect(() => {
    if (!activeEntry) {
      setTimeout(() => scanInputRef.current?.focus(), 300);
    }
  }, [activeEntry, data]);

  const isActive = data?.state === "notStarted" || data?.state === "inProgress";
  const isCounted = data?.state === "counted";
  const isVoided = data?.state === "voided";

  const handleScan = (barcode: string) => {
    setScanError("");
    if (!barcode.trim() || !data) return;
    const entry = data.entries.find(e => e.inventoryItem.barcode === barcode);
    if (!entry) {
      setScanError(`Barcode "${barcode}" is not part of this count.`);
      setScanValue("");
      return;
    }
    if (entry.lineCountStatus === "counted") {
      setScanError(`"${entry.inventoryItem.name}" has already been counted. Scan again to update.`);
    }
    setActiveEntry(entry);
    setCountValue(entry.counted || "");
    setDamagedValue(entry.damaged || "");
    setReason(entry.adjustmentReason || "");
    setScanValue("");
    setTimeout(() => countInputRef.current?.focus(), 300);
  };

  const handleCount = async () => {
    if (!activeEntry) return;
    const counted = parseFloat(countValue);
    if (isNaN(counted) || counted < 0) return;
    setSaving(true);
    try {
      await fetch("/api/cycle-count", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: activeEntry.id,
          counted,
          damaged: damagedValue === "" ? null : parseFloat(damagedValue),
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

  const handleFinish = async () => {
    try {
      await fetch("/api/cycle-count", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleCountId: id, state: "counted" }),
      });
      setShowFinish(false);
      fetchData();
    } catch {}
  };

  const filteredEntries = data?.entries.filter(e => {
    if (filter === "pending") return e.lineCountStatus === "notCounted" || e.lineCountStatus === "inProgress";
    if (filter === "counted") return e.lineCountStatus === "counted";
    if (filter === "skipped") return e.lineCountStatus === "skipped";
    if (filter === "variance") return e.lineCountStatus === "counted" && (lineVariance(e) ?? 0) !== 0;
    return true;
  }) || [];

  if (loading) return <div className="flex justify-center py-12"><p>Loading...</p></div>;
  if (!data) return <div className="flex justify-center py-12"><p>Count not found</p></div>;

  const expectedDisplay = activeEntry?.onHand ?? (activeEntry ? activeEntry.inventoryItem.quantity.toFixed(2) : null);
  const variancePreview = activeEntry && expectedDisplay !== null && countValue !== ""
    ? parseFloat(countValue) - parseFloat(expectedDisplay)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.push("/cycle-count")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold truncate">{data.description}</h2>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stateColors[data.state]}`}>
              {stateLabels[data.state]}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{data.documentNumber}</span>
            {data.warehouse && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {data.warehouse.name}
              </span>
            )}
            {data.assignedTo && (
              <span className="inline-flex items-center gap-1">
                <UserIcon className="h-3 w-3" />
                {data.assignedTo.name || data.assignedTo.email}
              </span>
            )}
            <span>{data.summary.linesInCount}/{data.summary.totalLines} counted</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/cycle-count/export-xlsx?id=${id}`, "_blank")}
            title="Download Excel"
          >
            <Download className="mr-1 h-4 w-4" />
            XLSX
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/api/cycle-count/export?id=${id}`, "_blank")}
            title="Download CSV"
          >
            CSV
          </Button>
        </div>
      </div>

      {/* Reconcile-in-Sage banner */}
      {isCounted && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div className="flex-1">
              <p className="font-medium text-blue-900">Counting complete — reconcile in Sage</p>
              <p className="mt-0.5 text-sm text-blue-800">
                This count has been marked as counted. Reconciliation (accepting adjustments and posting to GL) happens in the Sage Intacct UI, not here.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://www.intacct.com/ia/acct/login.phtml", "_blank")}
            >
              Open Sage
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      )}

      {isVoided && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3 text-sm text-red-800">
            This cycle count has been voided. It cannot be edited.
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${data.summary.totalLines > 0
              ? Math.round((data.summary.linesInCount / data.summary.totalLines) * 100)
              : 0}%`,
          }}
        />
      </div>

      {/* Scanner */}
      {isActive && !activeEntry && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <form onSubmit={e => { e.preventDefault(); handleScan(scanValue); }} className="space-y-2">
              <Label className="text-xs text-muted-foreground">Scan or enter a barcode to count</Label>
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
              {scanError && <p className="text-xs text-destructive">{scanError}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      {/* Active Count Entry */}
      {activeEntry && isActive && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{activeEntry.inventoryItem.name}</h3>
              <p className="text-sm font-mono text-muted-foreground">{activeEntry.inventoryItem.barcode}</p>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {activeEntry.zone && <span>Zone: {activeEntry.zone}</span>}
                {activeEntry.aisle && <span>Aisle: {activeEntry.aisle}</span>}
                {activeEntry.row && <span>Row: {activeEntry.row}</span>}
                {activeEntry.bin && <span>Bin: {activeEntry.bin}</span>}
                {activeEntry.serialNumber && <span>SN: {activeEntry.serialNumber}</span>}
                {activeEntry.lotNumber && <span>Lot: {activeEntry.lotNumber}</span>}
              </div>
            </div>

            {data.showQuantityOnHand && expectedDisplay !== null && (
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">System on-hand</p>
                <p className="text-3xl font-bold font-mono">{expectedDisplay}</p>
                <p className="text-xs text-muted-foreground">{activeEntry.inventoryItem.unit || "units"}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Counted *</Label>
                <Input
                  ref={countInputRef}
                  type="number"
                  min={0}
                  step="0.01"
                  value={countValue}
                  onChange={e => setCountValue(e.target.value)}
                  placeholder="0"
                  className="text-lg font-mono text-center"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Damaged</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={damagedValue}
                  onChange={e => setDamagedValue(e.target.value)}
                  placeholder="0"
                  className="text-lg font-mono text-center"
                />
              </div>
            </div>

            {variancePreview !== null && variancePreview !== 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Variance: {variancePreview > 0 ? "+" : ""}{variancePreview.toFixed(2)}
                  </span>
                </div>
                <Label>Adjustment reason (optional)</Label>
                <Input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. damaged, missing, found extra"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setActiveEntry(null)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleSkip} disabled={saving}>
                <SkipForward className="mr-1 h-4 w-4" /> Skip
              </Button>
              <Button
                className="flex-1"
                onClick={handleCount}
                disabled={saving || countValue === ""}
              >
                <Check className="mr-1 h-4 w-4" />
                {saving ? "Saving..." : "Record"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finish action */}
      {isActive && data.summary.linesInCount > 0 && data.summary.linesPending === 0 && !activeEntry && (
        <Button className="w-full" onClick={() => setShowFinish(true)}>
          <CheckCircle2 className="mr-2 h-4 w-4" /> Finish counting
        </Button>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(["all", "pending", "counted", "variance", "skipped"] as const).map(f => {
          const count =
            f === "all" ? data.entries.length :
            f === "pending" ? data.summary.linesPending :
            f === "counted" ? data.summary.linesInCount :
            f === "variance" ? data.summary.linesWithVariance :
            data.summary.linesSkipped;
          const label =
            f === "all" ? "All" :
            f === "pending" ? "Pending" :
            f === "counted" ? "Counted" :
            f === "variance" ? "Variance" :
            "Skipped";
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                filter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Entry list */}
      <div className="space-y-2">
        {filteredEntries.map(entry => {
          const v = lineVariance(entry);
          const onHandDisplay = entry.onHand ?? (isActive ? entry.inventoryItem.quantity.toFixed(2) : null);
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${
                entry.lineCountStatus === "counted" && (v ?? 0) !== 0
                  ? "border-amber-200 bg-amber-50"
                  : entry.lineCountStatus === "counted"
                  ? "border-emerald-200 bg-emerald-50"
                  : entry.lineCountStatus === "skipped"
                  ? "border-gray-200 bg-gray-50 opacity-60"
                  : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{entry.inventoryItem.name}</p>
                <p className="text-xs font-mono text-muted-foreground">{entry.inventoryItem.barcode}</p>
                {(entry.zone || entry.aisle || entry.row || entry.bin) && (
                  <p className="text-xs text-muted-foreground">
                    {[entry.zone, entry.aisle, entry.row, entry.bin].filter(Boolean).join(" → ")}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                {entry.lineCountStatus === "counted" ? (
                  <div>
                    <span className="text-sm font-mono font-bold">{entry.counted}</span>
                    {entry.damaged && parseFloat(entry.damaged) > 0 && (
                      <span className="text-xs text-amber-700 ml-1">({entry.damaged} dmg)</span>
                    )}
                    {onHandDisplay !== null && (
                      <span className="text-xs text-muted-foreground"> / {onHandDisplay}</span>
                    )}
                    {v !== null && v !== 0 && (
                      <p className={`text-xs font-medium ${v > 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {v > 0 ? "+" : ""}{v.toFixed(2)}
                      </p>
                    )}
                  </div>
                ) : entry.lineCountStatus === "skipped" ? (
                  <Badge variant="outline">Skipped</Badge>
                ) : (
                  <div>
                    {onHandDisplay !== null && (
                      <span className="text-sm font-mono text-muted-foreground">{onHandDisplay} on-hand</span>
                    )}
                    {isActive && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-2"
                        onClick={() => {
                          setActiveEntry(entry);
                          setCountValue("");
                          setDamagedValue("");
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
          );
        })}
      </div>

      {/* Finish dialog */}
      <Dialog open={showFinish} onOpenChange={setShowFinish}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish counting?</DialogTitle>
            <DialogDescription>
              This marks the count as complete and ready for reconciliation in Sage Intacct.
              {data.summary.linesWithVariance > 0 && (
                <span className="block mt-2 font-medium text-amber-600">
                  {data.summary.linesWithVariance} lines have variances that will be reviewed in Sage.
                </span>
              )}
              Once finished, the app can no longer edit line quantities.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinish(false)}>Cancel</Button>
            <Button onClick={handleFinish}>Finish counting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

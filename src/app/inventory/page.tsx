"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  Download,
  Upload,
  Package,
  MapPin,
  ChevronRight,
  AlertTriangle,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface InventoryItem {
  id: string;
  barcode: string;
  name: string;
  description: string | null;
  quantity: number;
  bin: string | null;
  row: string | null;
  aisle: string | null;
  zone: string | null;
  unit: string | null;
  category: string | null;
  condition: string;
  minStock: number;
  updatedAt: string;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState("skip");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Edit state
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState(0);
  const [editBin, setEditBin] = useState("");
  const [editRow, setEditRow] = useState("");
  const [editAisle, setEditAisle] = useState("");
  const [editZone, setEditZone] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editCondition, setEditCondition] = useState("GOOD");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryFilter !== "all") params.set("category", categoryFilter);

    try {
      const res = await fetch(`/api/inventory?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      if (data.categories) setCategories(data.categories);
    } catch {
      console.error("Failed to fetch inventory");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openDetail = (item: InventoryItem) => {
    setSelectedItem(item);
    setEditName(item.name);
    setEditQuantity(item.quantity);
    setEditBin(item.bin || "");
    setEditRow(item.row || "");
    setEditAisle(item.aisle || "");
    setEditZone(item.zone || "");
    setEditUnit(item.unit || "");
    setEditCondition(item.condition);
    setEditDescription(item.description || "");
    setShowDetail(true);
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/inventory`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedItem.id,
          name: editName,
          quantity: editQuantity,
          bin: editBin,
          row: editRow,
          aisle: editAisle,
          zone: editZone,
          unit: editUnit,
          condition: editCondition,
          description: editDescription,
        }),
      });

      if (res.ok) {
        setShowDetail(false);
        fetchItems();
      }
    } catch {
      console.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    if (!confirm(`Delete "${selectedItem.name}"? This cannot be undone.`))
      return;

    try {
      await fetch(`/api/inventory?id=${selectedItem.id}`, { method: "DELETE" });
      setShowDetail(false);
      fetchItems();
    } catch {
      console.error("Failed to delete");
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export/csv");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExport(false);
    } catch {
      console.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleSyncSage = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sage/sync", { method: "POST" });
      const data = await res.json();
      alert(data.message || "Sync complete");
      setShowExport(false);
    } catch {
      alert("Sync failed. Check your Sage Intacct configuration.");
    } finally {
      setSyncing(false);
    }
  };

  const printLabel = (item: InventoryItem) => {
    const params = new URLSearchParams({
      items: item.id,
      size: "30252",
      copies: "1",
      showName: "true",
      showBarcode: "true",
      showLocation: "false",
      showQty: "false",
      showDate: "false",
      customText: "",
      barcodeType: "CODE128",
      fontSize: "medium",
    });
    window.open(`/api/labels?${params}`, "_blank");
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-32">
            <Filter className="mr-1 h-3 w-3" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action Bar */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setShowImport(true)}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Import
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setShowExport(true)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Item Count */}
      <p className="text-xs text-muted-foreground">
        {items.length} item{items.length !== 1 ? "s" : ""}
      </p>

      {/* Item List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-border/50 bg-muted/30"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No items found</p>
            <p className="text-sm text-muted-foreground">
              {search
                ? "Try a different search term"
                : "Scan some barcodes to add inventory"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="space-y-2 md:hidden">
            {items.map((item) => {
              const isLowStock = item.quantity <= item.minStock && item.minStock > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => openDetail(item)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/50 p-3 text-left transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {item.name}
                      </p>
                      {isLowStock && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      )}
                    </div>
                    <p
                      className="text-xs text-muted-foreground"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {item.barcode}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      {(item.zone || item.aisle || item.row || item.bin) && (
                        <span className="flex items-center text-xs text-muted-foreground">
                          <MapPin className="mr-0.5 h-3 w-3" />
                          {[item.zone, item.aisle, item.row, item.bin].filter(Boolean).join(" \u2192 ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        printLabel(item);
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:text-primary transition-colors"
                      title="Print label"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    <Badge
                      variant={isLowStock ? "warning" : "secondary"}
                      className="tabular-nums"
                    >
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {item.quantity}
                      </span>
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Item ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Item Name</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Qty</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Condition</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Updated</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isLowStock = item.quantity <= item.minStock && item.minStock > 0;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => openDetail(item)}
                      className="cursor-pointer border-b border-border/30 transition-colors hover:bg-accent/50 last:border-b-0"
                    >
                      <td
                        className="px-4 py-3 text-muted-foreground"
                        style={{ fontFamily: "'JetBrains Mono', monospace" }}
                      >
                        {item.barcode}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.name}</span>
                          {isLowStock && (
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge
                          variant={isLowStock ? "warning" : "secondary"}
                          className="tabular-nums"
                        >
                          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            {item.quantity}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {[item.zone, item.aisle, item.row, item.bin].filter(Boolean).join(" \u2192 ") || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{item.condition}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(item.updatedAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            printLabel(item);
                          }}
                          className="rounded-md p-1 text-muted-foreground hover:text-primary transition-colors"
                          title="Print label"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Item Detail / Edit Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
              Barcode:{" "}
              <code
                className="rounded bg-muted px-1.5 py-0.5 text-xs"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {selectedItem?.barcode}
              </code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={editCondition} onValueChange={setEditCondition}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="GOOD">Good</SelectItem>
                    <SelectItem value="FAIR">Fair</SelectItem>
                    <SelectItem value="POOR">Poor</SelectItem>
                    <SelectItem value="DAMAGED">Damaged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bin</Label>
                <Input value={editBin} onChange={(e) => setEditBin(e.target.value)} placeholder="B-12" />
              </div>
              <div className="space-y-2">
                <Label>Row</Label>
                <Input value={editRow} onChange={(e) => setEditRow(e.target.value)} placeholder="R-3" />
              </div>
              <div className="space-y-2">
                <Label>Aisle</Label>
                <Input value={editAisle} onChange={(e) => setEditAisle(e.target.value)} placeholder="A-1" />
              </div>
              <div className="space-y-2">
                <Label>Zone</Label>
                <Input value={editZone} onChange={(e) => setEditZone(e.target.value)} placeholder="Zone A" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} placeholder="each, box, pallet..." />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setShowDetail(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Export Inventory</DialogTitle>
            <DialogDescription>
              Choose how to export your inventory data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={handleExportCSV}
              disabled={exporting}
            >
              <Download className="mr-3 h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-medium">
                  {exporting ? "Downloading..." : "Download CSV"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Export all items as a spreadsheet
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3"
              onClick={handleSyncSage}
              disabled={syncing}
            >
              <Upload className="mr-3 h-5 w-5 text-emerald-400" />
              <div className="text-left">
                <p className="font-medium">
                  {syncing ? "Syncing..." : "Sync to Sage Intacct"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Push inventory data to Sage
                </p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={showImport} onOpenChange={(open) => { setShowImport(open); if (!open) { setImportResult(null); setImportFile(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Inventory from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with your product data. Required columns: barcode (or UPC/SKU) and name (or title).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>CSV File</Label>
              <Input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-2">
              <Label>Duplicate Handling</Label>
              <Select value={importMode} onValueChange={setImportMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip existing items</SelectItem>
                  <SelectItem value="update">Update existing items</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                What to do when a barcode already exists in inventory
              </p>
            </div>

            <a href="/api/import/template" download className="text-xs text-primary hover:underline">
              Download CSV template
            </a>

            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-xs font-medium">Supported columns:</p>
              <p className="text-xs text-muted-foreground">
                barcode/upc/sku (required), name/title (required), description, quantity/qty, bin, row, aisle, zone, unit, category, condition, cost_price, min_stock
              </p>
            </div>

            {importResult && (
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-sm font-medium">Import Complete</p>
                <p className="text-xs text-emerald-600">Imported: {importResult.imported}</p>
                {importResult.updated > 0 && <p className="text-xs text-blue-600">Updated: {importResult.updated}</p>}
                {importResult.skipped > 0 && <p className="text-xs text-muted-foreground">Skipped: {importResult.skipped}</p>}
                {importResult.errors?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-destructive">Errors ({importResult.errors.length}):</p>
                    <div className="max-h-24 overflow-y-auto">
                      {importResult.errors.map((err: string, i: number) => (
                        <p key={i} className="text-xs text-destructive">{err}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowImport(false)}>
              {importResult ? "Close" : "Cancel"}
            </Button>
            {!importResult && (
              <Button
                onClick={async () => {
                  if (!importFile) return;
                  setImporting(true);
                  const formData = new FormData();
                  formData.append("file", importFile);
                  formData.append("mode", importMode);
                  try {
                    const res = await fetch("/api/import/csv", { method: "POST", body: formData });
                    const data = await res.json();
                    if (res.ok) {
                      setImportResult(data);
                      fetchItems();
                    } else {
                      setImportResult({ imported: 0, errors: [data.error] });
                    }
                  } catch {
                    setImportResult({ imported: 0, errors: ["Network error"] });
                  } finally {
                    setImporting(false);
                  }
                }}
                disabled={!importFile || importing}
              >
                {importing ? "Importing..." : "Import"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

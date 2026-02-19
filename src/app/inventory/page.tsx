"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Plus,
  Trash2,
  Check,
  X,
  Pencil,
  ArrowUp,
  ArrowDown,
  Minus,
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

const CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"];
const ROWS_PER_PAGE = 50;

type SortField = "barcode" | "name" | "quantity" | "bin" | "row" | "aisle" | "zone" | "unit" | "category" | "condition";

const COLUMNS: { key: SortField; label: string; align?: "right" }[] = [
  { key: "barcode", label: "Item ID" },
  { key: "name", label: "Item Name" },
  { key: "quantity", label: "Qty", align: "right" },
  { key: "bin", label: "Bin" },
  { key: "row", label: "Row" },
  { key: "aisle", label: "Aisle" },
  { key: "zone", label: "Zone" },
  { key: "unit", label: "Unit" },
  { key: "category", label: "Category" },
  { key: "condition", label: "Condition" },
];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState<string[]>([]);

  // Table state
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newRow, setNewRow] = useState<Record<string, string> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [flashCell, setFlashCell] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [savingNewRow, setSavingNewRow] = useState(false);

  // Detail dialog (double-click)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showDetail, setShowDetail] = useState(false);
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

  // Export/import
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState("skip");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const editInputRef = useRef<HTMLInputElement>(null);

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

  // Focus edit input when cell editing starts
  useEffect(() => {
    if (editingCell) {
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingCell]);

  // ─── Sorting & Pagination ──────────────────────────────────

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const aVal = (a as any)[sortField] ?? "";
      const bVal = (b as any)[sortField] ?? "";
      let cmp: number;
      if (sortField === "quantity") {
        cmp = (aVal as number) - (bVal as number);
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: "base" });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortField, sortDir]);

  const paginatedItems = useMemo(
    () => sortedItems.slice(0, page * ROWS_PER_PAGE),
    [sortedItems, page]
  );

  const hasMore = paginatedItems.length < sortedItems.length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // ─── Summary Stats ─────────────────────────────────────────

  const totalQty = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  // ─── Inline Cell Editing ───────────────────────────────────

  const startEdit = (id: string, field: string, currentValue: string | number | null) => {
    setEditingCell({ id, field });
    setEditValue(String(currentValue ?? ""));
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const handleCellSave = async (itemId: string, field: string, value: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const parsedValue = field === "quantity" || field === "minStock" ? parseInt(value) || 0 : value;

    // Optimistic update
    setItems(prev =>
      prev.map(i =>
        i.id === itemId ? { ...i, [field]: parsedValue } : i
      )
    );
    setEditingCell(null);
    setEditValue("");

    // Flash green
    const key = `${itemId}-${field}`;
    setFlashCell(key);
    setTimeout(() => setFlashCell(null), 600);

    try {
      await fetch("/api/inventory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: itemId,
          name: field === "name" ? parsedValue : item.name,
          description: item.description,
          quantity: field === "quantity" ? parsedValue : item.quantity,
          bin: field === "bin" ? parsedValue : item.bin,
          row: field === "row" ? parsedValue : item.row,
          aisle: field === "aisle" ? parsedValue : item.aisle,
          zone: field === "zone" ? parsedValue : item.zone,
          unit: field === "unit" ? parsedValue : item.unit,
          condition: field === "condition" ? parsedValue : item.condition,
        }),
      });
    } catch {
      fetchItems();
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, itemId: string, field: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCellSave(itemId, field, editValue);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  // ─── Quick Qty +/- ─────────────────────────────────────────

  const adjustQty = async (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    setItems(prev => prev.map(i => (i.id === item.id ? { ...i, quantity: newQty } : i)));

    const key = `${item.id}-quantity`;
    setFlashCell(key);
    setTimeout(() => setFlashCell(null), 600);

    try {
      await fetch("/api/inventory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          name: item.name,
          description: item.description,
          quantity: newQty,
          bin: item.bin,
          row: item.row,
          aisle: item.aisle,
          zone: item.zone,
          unit: item.unit,
          condition: item.condition,
        }),
      });
    } catch {
      fetchItems();
    }
  };

  // ─── Add New Row ───────────────────────────────────────────

  const startNewRow = () => {
    setNewRow({
      barcode: "",
      name: "",
      quantity: "1",
      bin: "",
      row: "",
      aisle: "",
      zone: "",
      unit: "",
      category: "",
      condition: "GOOD",
    });
  };

  const cancelNewRow = () => setNewRow(null);

  const saveNewRow = async () => {
    if (!newRow) return;
    if (!newRow.barcode?.trim() || !newRow.name?.trim()) return;

    setSavingNewRow(true);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: newRow.barcode,
          action: "CREATE",
          item: {
            name: newRow.name,
            description: "",
            quantity: parseInt(newRow.quantity || "1") || 1,
            bin: newRow.bin || null,
            row: newRow.row || null,
            aisle: newRow.aisle || null,
            zone: newRow.zone || null,
            unit: newRow.unit || null,
            category: newRow.category || null,
            condition: newRow.condition || "GOOD",
          },
        }),
      });

      if (res.ok) {
        setNewRow(null);
        fetchItems();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create item");
      }
    } catch {
      alert("Network error");
    } finally {
      setSavingNewRow(false);
    }
  };

  // ─── Delete ────────────────────────────────────────────────

  const handleDeleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setConfirmDelete(null);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    try {
      await fetch(`/api/inventory?id=${id}`, { method: "DELETE" });
    } catch {
      fetchItems();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected items? This cannot be undone.`)) return;

    const idsToDelete = Array.from(selectedIds);
    setItems(prev => prev.filter(i => !selectedIds.has(i.id)));
    setSelectedIds(new Set());

    for (const id of idsToDelete) {
      try {
        await fetch(`/api/inventory?id=${id}`, { method: "DELETE" });
      } catch {}
    }
  };

  // ─── Bulk Selection ────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedItems.map(i => i.id)));
    }
  };

  // ─── Print Label ───────────────────────────────────────────

  const printLabel = (itemOrIds: InventoryItem | string[]) => {
    const ids = Array.isArray(itemOrIds) ? itemOrIds : [itemOrIds.id];
    const params = new URLSearchParams({
      items: ids.join(","),
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

  // ─── Detail Dialog (double-click) ──────────────────────────

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

  const handleDetailSave = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
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
    } catch {} finally {
      setSaving(false);
    }
  };

  const handleDetailDelete = async () => {
    if (!selectedItem) return;
    setShowDetail(false);
    setConfirmDelete(null);
    handleDeleteItem(selectedItem.id);
  };

  // ─── Export / Import ───────────────────────────────────────

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
    } catch {} finally {
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

  const handleBulkExport = () => {
    if (selectedIds.size === 0) return;
    // Export all, user can filter in spreadsheet
    handleExportCSV();
  };

  // ─── Render helpers ────────────────────────────────────────

  const renderCellContent = (item: InventoryItem, field: SortField) => {
    const cellKey = `${item.id}-${field}`;
    const isEditing = editingCell?.id === item.id && editingCell?.field === field;
    const isFlashing = flashCell === cellKey;
    const value = (item as any)[field];

    if (isEditing) {
      if (field === "condition") {
        return (
          <Select
            value={editValue}
            onValueChange={v => {
              handleCellSave(item.id, field, v);
            }}
          >
            <SelectTrigger className="h-7 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      return (
        <Input
          ref={editInputRef}
          type={field === "quantity" ? "number" : "text"}
          min={field === "quantity" ? 0 : undefined}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => handleCellSave(item.id, field, editValue)}
          onKeyDown={e => handleCellKeyDown(e, item.id, field)}
          className="h-7 text-xs px-1.5 w-full min-w-[60px]"
        />
      );
    }

    const baseClass = `cursor-pointer transition-colors duration-300 rounded px-1 -mx-1 ${
      isFlashing ? "bg-emerald-100" : "hover:bg-accent/50"
    }`;

    if (field === "barcode") {
      return (
        <span
          className={baseClass}
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
          onClick={() => startEdit(item.id, field, value)}
        >
          {value || "—"}
        </span>
      );
    }

    if (field === "quantity") {
      const isLow = item.quantity <= item.minStock && item.minStock > 0;
      return (
        <div className="group flex items-center justify-end gap-0.5">
          <button
            onClick={e => { e.stopPropagation(); adjustQty(item, -1); }}
            className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-opacity"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span
            className={`${baseClass} tabular-nums font-medium ${isLow ? "text-amber-600" : ""}`}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            onClick={() => startEdit(item.id, field, value)}
          >
            {value}
          </span>
          <button
            onClick={e => { e.stopPropagation(); adjustQty(item, 1); }}
            className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-opacity"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      );
    }

    if (field === "condition") {
      return (
        <span
          className={baseClass}
          onClick={() => startEdit(item.id, field, value)}
        >
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 cursor-pointer">
            {value}
          </Badge>
        </span>
      );
    }

    return (
      <span
        className={`${baseClass} truncate block max-w-[120px]`}
        onClick={() => startEdit(item.id, field, value)}
        title={value || ""}
      >
        {value || "—"}
      </span>
    );
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-32 h-9">
            <Filter className="mr-1 h-3 w-3" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={startNewRow} disabled={!!newRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Item
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowExport(true)}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <span><strong className="text-foreground">{items.length}</strong> items</span>
        <span><strong className="text-foreground">{totalQty.toLocaleString()}</strong> total qty</span>
        {selectedIds.size > 0 && (
          <span className="text-primary font-medium">{selectedIds.size} selected</span>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => printLabel(Array.from(selectedIds))}>
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print Labels
          </Button>
          <Button size="sm" variant="outline" onClick={handleBulkExport}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 animate-pulse rounded border border-border/50 bg-muted/30" />
          ))}
        </div>
      ) : items.length === 0 && !newRow ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No items found</p>
            <p className="text-sm text-muted-foreground">
              {search ? "Try a different search term" : "Add items or import a CSV to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="space-y-2 sm:hidden">
            {paginatedItems.map(item => {
              const isLow = item.quantity <= item.minStock && item.minStock > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => openDetail(item)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/50 p-3 text-left transition-colors hover:bg-accent/50 active:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      {isLow && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                    </div>
                    <p className="text-xs text-muted-foreground" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {item.barcode}
                    </p>
                    {(item.zone || item.aisle || item.row || item.bin) && (
                      <span className="flex items-center text-xs text-muted-foreground mt-0.5">
                        <MapPin className="mr-0.5 h-3 w-3" />
                        {[item.zone, item.aisle, item.row, item.bin].filter(Boolean).join(" \u2192 ")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); printLabel(item); }}
                      className="rounded-md p-1 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    <Badge variant={isLow ? "warning" : "secondary"} className="tabular-nums">
                      <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{item.quantity}</span>
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-border/50">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  {/* Checkbox */}
                  <th className="w-8 px-2 py-2.5">
                    <input
                      type="checkbox"
                      checked={paginatedItems.length > 0 && selectedIds.size === paginatedItems.length}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-muted-foreground/50 accent-primary cursor-pointer"
                    />
                  </th>
                  {/* Data columns */}
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      className={`px-2 py-2.5 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${
                        col.align === "right" ? "text-right" : "text-left"
                      }`}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortField === col.key && (
                          sortDir === "asc"
                            ? <ArrowUp className="h-3 w-3" />
                            : <ArrowDown className="h-3 w-3" />
                        )}
                      </span>
                    </th>
                  ))}
                  {/* Actions */}
                  <th className="w-24 px-2 py-2.5 text-center font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* New row */}
                {newRow && (
                  <tr className="border-b border-border/50 bg-primary/5">
                    <td className="px-2 py-1.5" />
                    {COLUMNS.map(col => (
                      <td key={col.key} className="px-2 py-1.5">
                        {col.key === "condition" ? (
                          <Select
                            value={newRow.condition || "GOOD"}
                            onValueChange={v => setNewRow({ ...newRow, condition: v })}
                          >
                            <SelectTrigger className="h-7 text-xs w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CONDITIONS.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            type={col.key === "quantity" ? "number" : "text"}
                            min={col.key === "quantity" ? 0 : undefined}
                            value={newRow[col.key] || ""}
                            onChange={e => setNewRow({ ...newRow, [col.key]: e.target.value })}
                            placeholder={col.label}
                            className={`h-7 text-xs px-1.5 ${
                              (col.key === "barcode" || col.key === "name") && !newRow[col.key]?.trim()
                                ? "ring-1 ring-destructive/50"
                                : ""
                            }`}
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={saveNewRow}
                          disabled={savingNewRow || !newRow.barcode?.trim() || !newRow.name?.trim()}
                          className="rounded p-1 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                          title="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={cancelNewRow}
                          className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {paginatedItems.map((item, idx) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-border/30 last:border-b-0 transition-colors ${
                        isSelected
                          ? "bg-primary/5"
                          : idx % 2 === 0
                          ? ""
                          : "bg-muted/15"
                      } hover:bg-accent/30`}
                    >
                      {/* Checkbox */}
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="h-3.5 w-3.5 rounded border-muted-foreground/50 accent-primary cursor-pointer"
                        />
                      </td>
                      {/* Data cells */}
                      {COLUMNS.map(col => (
                        <td
                          key={col.key}
                          className={`px-2 py-1.5 ${col.align === "right" ? "text-right" : ""}`}
                        >
                          {renderCellContent(item, col.key)}
                        </td>
                      ))}
                      {/* Actions */}
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-center gap-0.5 relative">
                          <button
                            onClick={() => openDetail(item)}
                            className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                            title="Edit all fields"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); printLabel(item); }}
                            className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                            title="Print label"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setConfirmDelete(confirmDelete === item.id ? null : item.id);
                            }}
                            className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Inline delete confirm */}
                          {confirmDelete === item.id && (
                            <div className="absolute right-0 top-full z-20 mt-1 rounded-lg border bg-background p-2 shadow-lg text-xs whitespace-nowrap">
                              <p className="mb-1.5 font-medium">Delete this item?</p>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="rounded bg-destructive px-2 py-1 text-destructive-foreground hover:bg-destructive/90 transition-colors"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="rounded bg-muted px-2 py-1 hover:bg-muted/80 transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>
                Load More ({sortedItems.length - paginatedItems.length} remaining)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail / Edit Dialog */}
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
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min={0} value={editQuantity} onChange={e => setEditQuantity(parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={editCondition} onValueChange={setEditCondition}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Bin</Label>
                <Input value={editBin} onChange={e => setEditBin(e.target.value)} placeholder="B-12" />
              </div>
              <div className="space-y-2">
                <Label>Row</Label>
                <Input value={editRow} onChange={e => setEditRow(e.target.value)} placeholder="R-3" />
              </div>
              <div className="space-y-2">
                <Label>Aisle</Label>
                <Input value={editAisle} onChange={e => setEditAisle(e.target.value)} placeholder="A-1" />
              </div>
              <div className="space-y-2">
                <Label>Zone</Label>
                <Input value={editZone} onChange={e => setEditZone(e.target.value)} placeholder="Zone A" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input value={editUnit} onChange={e => setEditUnit(e.target.value)} placeholder="each, box, pallet..." />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="destructive" size="sm" onClick={handleDetailDelete}>
              Delete
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setShowDetail(false)}>Cancel</Button>
            <Button onClick={handleDetailSave} disabled={saving}>
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
            <DialogDescription>Choose how to export your inventory data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={handleExportCSV} disabled={exporting}>
              <Download className="mr-3 h-5 w-5 text-primary" />
              <div className="text-left">
                <p className="font-medium">{exporting ? "Downloading..." : "Download CSV"}</p>
                <p className="text-xs text-muted-foreground">Export all items as a spreadsheet</p>
              </div>
            </Button>
            <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={handleSyncSage} disabled={syncing}>
              <Upload className="mr-3 h-5 w-5 text-emerald-400" />
              <div className="text-left">
                <p className="font-medium">{syncing ? "Syncing..." : "Sync to Sage Intacct"}</p>
                <p className="text-xs text-muted-foreground">Push inventory data to Sage</p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={showImport} onOpenChange={open => { setShowImport(open); if (!open) { setImportResult(null); setImportFile(null); } }}>
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
              <Input type="file" accept=".csv,.tsv,.txt" onChange={e => setImportFile(e.target.files?.[0] || null)} />
            </div>
            <div className="space-y-2">
              <Label>Duplicate Handling</Label>
              <Select value={importMode} onValueChange={setImportMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip existing items</SelectItem>
                  <SelectItem value="update">Update existing items</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">What to do when a barcode already exists in inventory</p>
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

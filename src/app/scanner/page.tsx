"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import {
  Camera,
  CameraOff,
  Check,
  Plus,
  Package,
  Hash,
  Printer,
  Bluetooth,
  ScanBarcode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface ExistingItem {
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
}

type CameraMode = "idle" | "scanning" | "paused";

export default function ScannerPage() {
  const [activeTab, setActiveTab] = useState("scanner");
  const [cameraMode, setCameraMode] = useState<CameraMode>("idle");
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [existingItem, setExistingItem] = useState<ExistingItem | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showExistingDialog, setShowExistingDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [lookupSource, setLookupSource] = useState<string | null>(null);
  const [nameEdited, setNameEdited] = useState(false);
  const [lastSavedItemId, setLastSavedItemId] = useState<string | null>(null);
  const [scanDetected, setScanDetected] = useState(false);
  const [scannerValue, setScannerValue] = useState("");

  // New item form
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    quantity: 1,
    bin: "",
    row: "",
    aisle: "",
    zone: "",
    unit: "",
    category: "",
    condition: "GOOD",
  });

  // Existing item update
  const [addQuantity, setAddQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const feedbackTimeout = useRef<NodeJS.Timeout | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus scanner input on mount and tab switch
  useEffect(() => {
    if (activeTab === "scanner") {
      setTimeout(() => scannerInputRef.current?.focus(), 100);
    }
  }, [activeTab]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === Html5QrcodeScannerState.SCANNING) {
            scannerRef.current.stop();
          }
        } catch {}
      }
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (showNewDialog) {
      setNameEdited(false);
      setTimeout(() => nameInputRef.current?.focus(), 300);
    }
  }, [showNewDialog]);

  useEffect(() => {
    if (showExistingDialog) {
      setTimeout(() => qtyInputRef.current?.focus(), 300);
    }
  }, [showExistingDialog]);

  // Refocus scanner input when dialogs close
  useEffect(() => {
    if (!showNewDialog && !showExistingDialog && activeTab === "scanner") {
      setTimeout(() => {
        setScannerValue("");
        scannerInputRef.current?.focus();
      }, 200);
    }
  }, [showNewDialog, showExistingDialog, activeTab]);

  const showFeedback = useCallback(
    (type: "success" | "error", message: string) => {
      setFeedback({ type, message });
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      feedbackTimeout.current = setTimeout(() => setFeedback(null), 3000);
    },
    []
  );

  // ─── Shared barcode processing ───────────────────────────────

  const processBarcode = async (barcode: string) => {
    setLastBarcode(barcode);
    if (navigator.vibrate) navigator.vibrate(100);

    try {
      const res = await fetch(
        `/api/inventory?barcode=${encodeURIComponent(barcode)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setExistingItem(data.item);
          setAddQuantity(1);
          setNotes("");
          setShowExistingDialog(true);
        } else {
          try {
            const lookupRes = await fetch(`/api/lookup?barcode=${encodeURIComponent(barcode)}`);
            const lookupData = await lookupRes.json();
            setLookupSource(lookupData.source || "none");
            setNewItem({
              name: lookupData.name || barcode,
              description: lookupData.description || "",
              quantity: 1,
              bin: "",
              row: "",
              aisle: "",
              zone: "",
              unit: "",
              category: lookupData.category || "",
              condition: "GOOD",
            });
          } catch {
            setLookupSource(null);
            setNewItem({
              name: barcode,
              description: "",
              quantity: 1,
              bin: "",
              row: "",
              aisle: "",
              zone: "",
              unit: "",
              category: "",
              condition: "GOOD",
            });
          }
          setShowNewDialog(true);
        }
      }
    } catch {
      showFeedback("error", "Network error. Please try again.");
      if (activeTab === "camera") resumeScanning();
    }
  };

  // ─── Scanner mode (Bluetooth/USB) ────────────────────────────

  const handleScannerInput = async (barcode: string) => {
    if (!barcode.trim()) return;
    setScanDetected(true);
    setTimeout(() => setScanDetected(false), 800);
    setScanCount((c) => c + 1);
    await processBarcode(barcode.trim());
  };

  // ─── Camera mode ─────────────────────────────────────────────

  const startScanning = async () => {
    try {
      const scanner = new Html5Qrcode("scanner-viewport", {
        formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        verbose: false,
      });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 300, height: 200 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        onCameraScanSuccess,
        () => {}
      );

      setCameraMode("scanning");
    } catch (err) {
      console.error("Camera error:", err);
      showFeedback("error", "Could not access camera. Check permissions.");
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setCameraMode("idle");
  };

  const onCameraScanSuccess = async (decodedText: string) => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setCameraMode("paused");
    setScanCount((c) => c + 1);
    await processBarcode(decodedText);
  };

  const resumeScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setCameraMode("idle");
    setTimeout(() => startScanning(), 500);
  };

  // ─── Shared actions ──────────────────────────────────────────

  const printLabel = (itemId: string) => {
    const params = new URLSearchParams({
      items: itemId,
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

  const handleCreateItem = async () => {
    if (!lastBarcode || !newItem.name.trim()) return;
    setSaving(true);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: lastBarcode,
          action: "CREATE",
          item: newItem,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastSavedItemId(data.item?.id || null);
        showFeedback("success", `Added "${newItem.name}" to inventory`);
        setShowNewDialog(false);
      } else {
        const err = await res.json();
        showFeedback("error", err.error || "Failed to save");
      }
    } catch {
      showFeedback("error", "Network error");
    } finally {
      setSaving(false);
      if (activeTab === "camera") resumeScanning();
    }
  };

  const handleUpdateItem = async () => {
    if (!lastBarcode || !existingItem) return;
    setSaving(true);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: lastBarcode,
          action: "INCREMENT",
          quantityChange: addQuantity,
          notes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastSavedItemId(data.item?.id || null);
        showFeedback(
          "success",
          `Updated "${existingItem.name}" (+${addQuantity})`
        );
        setShowExistingDialog(false);
      } else {
        const err = await res.json();
        showFeedback("error", err.error || "Failed to update");
      }
    } catch {
      showFeedback("error", "Network error");
    } finally {
      setSaving(false);
      if (activeTab === "camera") resumeScanning();
    }
  };

  // Stop camera when switching away from camera tab
  const handleTabChange = async (value: string) => {
    if (value !== "camera" && scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
      setCameraMode("idle");
    }
    setActiveTab(value);
  };

  return (
    <div className="space-y-4">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`fixed left-4 right-4 top-16 z-50 mx-auto max-w-lg animate-in slide-in-from-top-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
              : "bg-red-50 text-red-700 ring-1 ring-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <Check className="h-4 w-4" />
            ) : null}
            {feedback.message}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full">
          <TabsTrigger value="scanner" className="flex-1 gap-2">
            <Bluetooth className="h-4 w-4" />
            Scanner
          </TabsTrigger>
          <TabsTrigger value="camera" className="flex-1 gap-2">
            <Camera className="h-4 w-4" />
            Camera
          </TabsTrigger>
        </TabsList>

        {/* ─── Scanner Tab ──────────────────────────────── */}
        <TabsContent value="scanner">
          <div className="mx-auto max-w-lg space-y-4 pt-2">
            {/* Status Hero */}
            <Card
              className={`border-border/50 transition-all duration-300 ${
                scanDetected
                  ? "border-emerald-300 bg-emerald-50"
                  : ""
              }`}
            >
              <CardContent className="flex flex-col items-center py-8 gap-3">
                {scanDetected ? (
                  <>
                    <div className="rounded-full bg-emerald-100 p-4">
                      <Check className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-emerald-700">
                        Barcode Detected!
                      </p>
                      <p className="text-sm text-emerald-600">Processing...</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-primary/10 p-4">
                      <Bluetooth className="h-8 w-8 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold">Scanner Ready</p>
                      <p className="text-sm text-muted-foreground">
                        Scan a barcode with your wireless scanner
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Barcode Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScannerInput(scannerValue);
              }}
            >
              <div className="relative">
                <ScanBarcode className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={scannerInputRef}
                  value={scannerValue}
                  onChange={(e) => setScannerValue(e.target.value)}
                  placeholder="Scan or type barcode..."
                  className="h-14 pl-12 text-lg ring-2 ring-primary/30 focus-visible:ring-primary/60"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  autoFocus
                />
              </div>
            </form>

            {/* Session Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  Session scans
                </span>
                <Badge variant="secondary">
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {scanCount}
                  </span>
                </Badge>
              </div>

              {lastBarcode && (
                <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Last barcode
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {lastBarcode}
                  </span>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ─── Camera Tab ───────────────────────────────── */}
        <TabsContent value="camera">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Scanner Viewport Column */}
            <div className="space-y-4 md:max-w-md">
              <Card className="overflow-hidden border-border/50">
                <CardContent className="p-0">
                  <div className="relative aspect-square w-full bg-black/50">
                    <div id="scanner-viewport" className="h-full w-full" />

                    {cameraMode === "scanning" && (
                      <div className="scan-line pointer-events-none absolute inset-x-0" />
                    )}

                    {cameraMode === "idle" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted/50">
                        <Camera className="h-12 w-12 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Tap below to start scanning
                        </p>
                      </div>
                    )}

                    {cameraMode === "paused" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <div className="rounded-full bg-primary/20 p-4">
                          <Check className="h-8 w-8 text-primary" />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Controls */}
              <div className="flex gap-3">
                {cameraMode === "idle" ? (
                  <Button onClick={startScanning} className="flex-1" size="lg">
                    <Camera className="mr-2 h-5 w-5" />
                    Start Camera
                  </Button>
                ) : (
                  <Button
                    onClick={stopScanning}
                    variant="destructive"
                    className="flex-1"
                    size="lg"
                  >
                    <CameraOff className="mr-2 h-5 w-5" />
                    Stop Camera
                  </Button>
                )}
              </div>
            </div>

            {/* Info / Controls Column */}
            <div className="space-y-4">
              {/* Session Info */}
              <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  Session scans
                </span>
                <Badge variant="secondary">
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {scanCount}
                  </span>
                </Badge>
              </div>

              {lastBarcode && (
                <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    Last barcode
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {lastBarcode}
                  </span>
                </div>
              )}

              {/* Manual Entry */}
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const input = form.elements.namedItem(
                        "manual-barcode"
                      ) as HTMLInputElement;
                      if (input.value.trim()) {
                        onCameraScanSuccess(input.value.trim());
                        input.value = "";
                      }
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      name="manual-barcode"
                      placeholder="Enter barcode manually..."
                      className="flex-1"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    />
                    <Button type="submit" variant="secondary">
                      <Hash className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Item Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              New Item
            </DialogTitle>
            <DialogDescription>
              Barcode{" "}
              <code
                className="rounded bg-muted px-1.5 py-0.5 text-xs"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {lastBarcode}
              </code>{" "}
              not found. Add it to inventory.
              {lookupSource && lookupSource !== "none" && (
                <>
                  {" "}
                  <span className="text-xs text-primary">
                    Name auto-filled from {lookupSource === "openfoodfacts" ? "Open Food Facts" : "UPC ItemDB"}.
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="item-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-name"
                ref={nameInputRef}
                value={newItem.name}
                onChange={(e) => {
                  setNewItem({ ...newItem, name: e.target.value });
                  setNameEdited(true);
                }}
                onFocus={() => setNameEdited(true)}
                placeholder="Item name"
                className={!nameEdited ? "ring-2 ring-primary/50" : ""}
              />
              {!nameEdited && (
                <p className="text-xs text-muted-foreground">Tap to edit name</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-desc">Description</Label>
              <Textarea
                id="item-desc"
                value={newItem.description}
                onChange={(e) =>
                  setNewItem({ ...newItem, description: e.target.value })
                }
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="item-qty">Quantity</Label>
                <Input
                  id="item-qty"
                  type="number"
                  min={0}
                  value={newItem.quantity}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      quantity: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={newItem.condition}
                  onValueChange={(v) =>
                    setNewItem({ ...newItem, condition: v })
                  }
                >
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
                <Label htmlFor="item-bin">Bin</Label>
                <Input id="item-bin" value={newItem.bin} onChange={(e) => setNewItem({ ...newItem, bin: e.target.value })} placeholder="Bin #" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-row">Row</Label>
                <Input id="item-row" value={newItem.row} onChange={(e) => setNewItem({ ...newItem, row: e.target.value })} placeholder="Row #" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="item-aisle">Aisle</Label>
                <Input id="item-aisle" value={newItem.aisle} onChange={(e) => setNewItem({ ...newItem, aisle: e.target.value })} placeholder="Aisle #" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-zone">Zone</Label>
                <Input id="item-zone" value={newItem.zone} onChange={(e) => setNewItem({ ...newItem, zone: e.target.value })} placeholder="Zone" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-unit">Unit</Label>
              <Input id="item-unit" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} placeholder="e.g. each, box, case, pallet" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-category">Category</Label>
              <Input
                id="item-category"
                value={newItem.category}
                onChange={(e) =>
                  setNewItem({ ...newItem, category: e.target.value })
                }
                placeholder="e.g. Electronics, Office Supplies"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowNewDialog(false);
                if (activeTab === "camera") resumeScanning();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await handleCreateItem();
                if (lastSavedItemId) printLabel(lastSavedItemId);
              }}
              disabled={saving || !newItem.name.trim()}
            >
              <Printer className="mr-1.5 h-4 w-4" />
              {saving ? "Saving..." : "Save & Print"}
            </Button>
            <Button
              onClick={handleCreateItem}
              disabled={saving || !newItem.name.trim()}
            >
              {saving ? "Saving..." : "Add to Inventory"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing Item Dialog */}
      <Dialog open={showExistingDialog} onOpenChange={setShowExistingDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Item Found
            </DialogTitle>
            <DialogDescription>
              This item already exists in your inventory.
            </DialogDescription>
          </DialogHeader>

          {existingItem && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/50 p-3 space-y-2">
                <p className="font-semibold">{existingItem.name}</p>
                {existingItem.description && (
                  <p className="text-sm text-muted-foreground">
                    {existingItem.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">
                    Qty: {existingItem.quantity}
                  </Badge>
                  {existingItem.bin && <Badge variant="outline">Bin: {existingItem.bin}</Badge>}
                  {existingItem.row && <Badge variant="outline">Row: {existingItem.row}</Badge>}
                  {existingItem.aisle && <Badge variant="outline">Aisle: {existingItem.aisle}</Badge>}
                  {existingItem.zone && <Badge variant="outline">Zone: {existingItem.zone}</Badge>}
                  {existingItem.unit && <Badge variant="outline">Unit: {existingItem.unit}</Badge>}
                  <Badge variant="outline">{existingItem.condition}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-qty">Add Quantity</Label>
                <Input
                  id="add-qty"
                  ref={qtyInputRef}
                  type="number"
                  min={1}
                  value={addQuantity}
                  onChange={(e) =>
                    setAddQuantity(parseInt(e.target.value) || 1)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scan-notes">Notes (optional)</Label>
                <Input
                  id="scan-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Received shipment #1234"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowExistingDialog(false);
                if (activeTab === "camera") resumeScanning();
              }}
            >
              Skip
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await handleUpdateItem();
                if (lastSavedItemId) printLabel(lastSavedItemId);
              }}
              disabled={saving}
            >
              <Printer className="mr-1.5 h-4 w-4" />
              {saving ? "Saving..." : "Save & Print"}
            </Button>
            <Button onClick={handleUpdateItem} disabled={saving}>
              {saving
                ? "Saving..."
                : `Add ${addQuantity} to Stock`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

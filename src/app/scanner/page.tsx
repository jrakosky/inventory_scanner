"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import {
  Camera,
  CameraOff,
  Flashlight,
  Check,
  Plus,
  Package,
  Hash,
  MapPin,
  MessageSquare,
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

interface ExistingItem {
  id: string;
  barcode: string;
  name: string;
  description: string | null;
  quantity: number;
  location: string | null;
  category: string | null;
  condition: string;
}

type ScanMode = "idle" | "scanning" | "paused";

export default function ScannerPage() {
  const [scanMode, setScanMode] = useState<ScanMode>("idle");
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

  // New item form
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    quantity: 1,
    location: "",
    category: "",
    condition: "GOOD",
  });

  // Existing item update
  const [addQuantity, setAddQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const feedbackTimeout = useRef<NodeJS.Timeout | null>(null);

  // Clean up on unmount
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

  const showFeedback = useCallback(
    (type: "success" | "error", message: string) => {
      setFeedback({ type, message });
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      feedbackTimeout.current = setTimeout(() => setFeedback(null), 3000);
    },
    []
  );

  const startScanning = async () => {
    try {
      const scanner = new Html5Qrcode("scanner-viewport", { formatsToSupport: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 300, height: 200 },
          aspectRatio: 1.0,
          disableFlip: false,
        },
        onScanSuccess,
        () => {} // ignore scan failures (expected when no barcode in frame)
      );

      setScanMode("scanning");
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
    setScanMode("idle");
  };

  const onScanSuccess = async (decodedText: string) => {
    // Pause scanner while handling result
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setScanMode("paused");
    setLastBarcode(decodedText);

    // Vibrate for haptic feedback
    if (navigator.vibrate) navigator.vibrate(100);

    // Check if item exists
    try {
      const res = await fetch(
        `/api/inventory?barcode=${encodeURIComponent(decodedText)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setExistingItem(data.item);
          setAddQuantity(1);
          setNotes("");
          setShowExistingDialog(true);
        } else {
          setNewItem({
            name: "",
            description: "",
            quantity: 1,
            location: "",
            category: "",
            condition: "GOOD",
          });
          setShowNewDialog(true);
        }
      }
    } catch (err) {
      showFeedback("error", "Network error. Please try again.");
      resumeScanning();
    }
  };

  const resumeScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setScanMode("idle");
    setTimeout(() => startScanning(), 500);
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
        setScanCount((c) => c + 1);
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
      resumeScanning();
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
        setScanCount((c) => c + 1);
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
      resumeScanning();
    }
  };

  return (
    <div className="space-y-4">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`fixed left-4 right-4 top-16 z-50 mx-auto max-w-lg animate-in slide-in-from-top-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
            feedback.type === "success"
              ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
              : "bg-destructive/15 text-destructive ring-1 ring-destructive/30"
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

      {/* Scanner Viewport */}
      <Card className="overflow-hidden border-border/50">
        <CardContent className="p-0">
          <div className="relative aspect-square w-full bg-black/50">
            <div id="scanner-viewport" className="h-full w-full" />

            {scanMode === "scanning" && (
              <div className="scan-line pointer-events-none absolute inset-x-0" />
            )}

            {scanMode === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted/50">
                <Camera className="h-12 w-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Tap below to start scanning
                </p>
              </div>
            )}

            {scanMode === "paused" && (
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
        {scanMode === "idle" ? (
          <Button onClick={startScanning} className="flex-1" size="lg">
            <Camera className="mr-2 h-5 w-5" />
            Start Scanner
          </Button>
        ) : (
          <Button
            onClick={stopScanning}
            variant="destructive"
            className="flex-1"
            size="lg"
          >
            <CameraOff className="mr-2 h-5 w-5" />
            Stop Scanner
          </Button>
        )}
      </div>

      {/* Session Info */}
      <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">Session scans</span>
        <Badge variant="secondary">
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {scanCount}
          </span>
        </Badge>
      </div>

      {lastBarcode && (
        <div className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3">
          <span className="text-sm text-muted-foreground">Last barcode</span>
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
                onScanSuccess(input.value.trim());
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
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-name"
                value={newItem.name}
                onChange={(e) =>
                  setNewItem({ ...newItem, name: e.target.value })
                }
                placeholder="Item name"
                autoFocus
              />
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

            <div className="space-y-2">
              <Label htmlFor="item-location">Location</Label>
              <Input
                id="item-location"
                value={newItem.location}
                onChange={(e) =>
                  setNewItem({ ...newItem, location: e.target.value })
                }
                placeholder="e.g. Warehouse A, Shelf 3"
              />
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
                resumeScanning();
              }}
            >
              Cancel
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
                  {existingItem.location && (
                    <Badge variant="outline">
                      <MapPin className="mr-1 h-3 w-3" />
                      {existingItem.location}
                    </Badge>
                  )}
                  <Badge variant="outline">{existingItem.condition}</Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-qty">Add Quantity</Label>
                <Input
                  id="add-qty"
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
                resumeScanning();
              }}
            >
              Skip
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

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Printer,
  Search,
  CheckSquare,
  Square,
  Tag,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
}

const LABEL_SIZES = {
  "30252": { name: "Address (1-1/8\" x 3-1/2\")", widthIn: 3.5, heightIn: 1.125, widthMM: 89, heightMM: 29 },
  "30336": { name: "Small Multi-Purpose (1\" x 2-1/8\")", widthIn: 2.125, heightIn: 1, widthMM: 54, heightMM: 25 },
  "30332": { name: "Square (1\" x 1\")", widthIn: 1, heightIn: 1, widthMM: 25, heightMM: 25 },
  "30256": { name: "Large Shipping (2-5/16\" x 4\")", widthIn: 4, heightIn: 2.3125, widthMM: 102, heightMM: 59 },
} as const;

const BARCODE_HEIGHTS: Record<string, number> = {
  "30252": 18,
  "30336": 12,
  "30332": 15,
  "30256": 25,
};

type LabelSizeKey = keyof typeof LABEL_SIZES;

export default function LabelsPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Label settings
  const [labelSize, setLabelSize] = useState<LabelSizeKey>("30252");
  const [showBarcode, setShowBarcode] = useState(true);
  const [showName, setShowName] = useState(true);
  const [showQty, setShowQty] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState("");
  const [barcodeType, setBarcodeType] = useState("CODE128");
  const [fontSize, setFontSize] = useState("medium");
  const [copies, setCopies] = useState(1);

  const barcodeRef = useRef<SVGSVGElement>(null);

  // Fetch inventory items
  useEffect(() => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Render barcode preview
  const previewItem = items.find((i) => selectedIds.has(i.id)) || items[0];

  const renderBarcode = useCallback(() => {
    if (!barcodeRef.current || !previewItem || !showBarcode) return;
    try {
      JsBarcode(barcodeRef.current, previewItem.barcode, {
        format: barcodeType,
        width: 2,
        height: BARCODE_HEIGHTS[labelSize] * 2,
        displayValue: true,
        fontSize: 12,
        margin: 2,
      });
    } catch {
      try {
        JsBarcode(barcodeRef.current, previewItem.barcode, {
          format: "CODE128",
          width: 2,
          height: BARCODE_HEIGHTS[labelSize] * 2,
          displayValue: true,
          fontSize: 12,
          margin: 2,
        });
      } catch {}
    }
  }, [previewItem, showBarcode, barcodeType, labelSize]);

  useEffect(() => {
    renderBarcode();
  }, [renderBarcode]);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.barcode.includes(search)
  );

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const handlePrint = () => {
    if (selectedIds.size === 0) return;
    const params = new URLSearchParams({
      items: Array.from(selectedIds).join(","),
      size: labelSize,
      copies: copies.toString(),
      showName: showName.toString(),
      showBarcode: showBarcode.toString(),
      showLocation: showLocation.toString(),
      showQty: showQty.toString(),
      showDate: showDate.toString(),
      customText: showCustom ? customText : "",
      barcodeType,
      fontSize,
    });
    window.open(`/api/labels?${params}`, "_blank");
  };

  const size = LABEL_SIZES[labelSize];
  const previewScale = 3;
  const previewWidth = size.widthIn * 96 * (previewScale / 3);
  const previewHeight = size.heightIn * 96 * (previewScale / 3);

  const fontSizeMap: Record<string, string> = {
    small: "8px",
    medium: "10px",
    large: "13px",
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Settings + Preview */}
        <div className="space-y-4 lg:col-span-1">
          {/* Label Size */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Label Size</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={labelSize} onValueChange={(v) => setLabelSize(v as LabelSizeKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(LABEL_SIZES) as [LabelSizeKey, typeof LABEL_SIZES[LabelSizeKey]][]).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      {key} - {val.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {size.widthMM}mm x {size.heightMM}mm
              </p>
            </CardContent>
          </Card>

          {/* Template Options */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Show barcode", value: showBarcode, set: setShowBarcode },
                { label: "Show item name", value: showName, set: setShowName },
                { label: "Show quantity", value: showQty, set: setShowQty },
                { label: "Show location", value: showLocation, set: setShowLocation },
                { label: "Show date", value: showDate, set: setShowDate },
                { label: "Show custom text", value: showCustom, set: setShowCustom },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => opt.set(!opt.value)}
                  className="flex w-full items-center gap-2 text-sm"
                >
                  {opt.value ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                  {opt.label}
                </button>
              ))}

              {showCustom && (
                <Input
                  placeholder="Custom text..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="mt-1"
                />
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Barcode type</Label>
                  <Select value={barcodeType} onValueChange={setBarcodeType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CODE128">CODE128</SelectItem>
                      <SelectItem value="EAN13">EAN13</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Font size</Label>
                  <Select value={fontSize} onValueChange={setFontSize}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <Label className="text-xs">Copies per item</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={copies}
                  onChange={(e) => setCopies(parseInt(e.target.value) || 1)}
                  className="h-8"
                />
              </div>
            </CardContent>
          </Card>

          {/* Live Preview */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center rounded-lg bg-muted/30 p-4">
                <div
                  className="flex flex-col items-center justify-center bg-white text-black overflow-hidden"
                  style={{
                    width: previewWidth,
                    height: previewHeight,
                    padding: "4px",
                    gap: "2px",
                    border: "1px dashed #ccc",
                    borderRadius: "2px",
                  }}
                >
                  {showName && previewItem && (
                    <div
                      style={{
                        fontSize: fontSizeMap[fontSize],
                        fontWeight: "bold",
                        textAlign: "center",
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      {previewItem.name}
                    </div>
                  )}
                  {showBarcode && previewItem && (
                    <svg ref={barcodeRef} style={{ maxWidth: "100%" }} />
                  )}
                  {showLocation && previewItem && [previewItem.zone, previewItem.aisle, previewItem.row, previewItem.bin].filter(Boolean).length > 0 && (
                    <div style={{ fontSize: "7px", color: "#666", fontFamily: "Arial, sans-serif" }}>
                      {[previewItem.zone, previewItem.aisle, previewItem.row, previewItem.bin].filter(Boolean).join(" \u2192 ")}
                    </div>
                  )}
                  {showQty && previewItem && (
                    <div style={{ fontSize: "7px", fontFamily: "Arial, sans-serif" }}>
                      Qty: {previewItem.quantity}
                    </div>
                  )}
                  {showDate && (
                    <div style={{ fontSize: "6px", color: "#999", fontFamily: "Arial, sans-serif" }}>
                      {new Date().toLocaleDateString()}
                    </div>
                  )}
                  {showCustom && customText && (
                    <div style={{ fontSize: "7px", fontFamily: "Arial, sans-serif" }}>
                      {customText}
                    </div>
                  )}
                  {!previewItem && (
                    <span style={{ fontSize: "9px", color: "#999" }}>
                      Select an item to preview
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Item Selector */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Select Items</CardTitle>
                <Badge variant="secondary">
                  {selectedIds.size} selected
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
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
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedIds.size === filteredItems.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              {loading ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Loading items...</p>
              ) : filteredItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No items found
                </p>
              ) : (
                <div className="max-h-[500px] overflow-y-auto space-y-1">
                  {filteredItems.map((item) => {
                    const selected = selectedIds.has(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          selected
                            ? "bg-primary/10 ring-1 ring-primary/30"
                            : "hover:bg-accent/50"
                        }`}
                      >
                        {selected ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{item.name}</p>
                          <p
                            className="text-xs text-muted-foreground"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {item.barcode}
                          </p>
                        </div>
                        {(item.zone || item.aisle || item.row || item.bin) && (
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            {[item.zone, item.aisle, item.row, item.bin].filter(Boolean).join(" \u2192 ")}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Print Button */}
          <Button
            onClick={handlePrint}
            disabled={selectedIds.size === 0}
            className="w-full"
            size="lg"
          >
            <Printer className="mr-2 h-5 w-5" />
            Print {selectedIds.size} Label{selectedIds.size !== 1 ? "s" : ""}
            {copies > 1 ? ` (${selectedIds.size * copies} total)` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

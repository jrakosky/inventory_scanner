import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LABEL_SIZES: Record<string, { widthMM: number; heightMM: number }> = {
  "30252": { widthMM: 89, heightMM: 29 },
  "30336": { widthMM: 54, heightMM: 25 },
  "30332": { widthMM: 25, heightMM: 25 },
  "30256": { widthMM: 102, heightMM: 59 },
};

const BARCODE_HEIGHTS: Record<string, number> = {
  "30252": 18,
  "30336": 12,
  "30332": 15,
  "30256": 25,
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const itemIds = url.searchParams.get("items")?.split(",").filter(Boolean) || [];
  const size = url.searchParams.get("size") || "30252";
  const copies = parseInt(url.searchParams.get("copies") || "1") || 1;
  const showName = url.searchParams.get("showName") !== "false";
  const showBarcode = url.searchParams.get("showBarcode") !== "false";
  const showLocation = url.searchParams.get("showLocation") === "true";
  const showQty = url.searchParams.get("showQty") === "true";
  const showDate = url.searchParams.get("showDate") === "true";
  const customText = url.searchParams.get("customText") || "";
  const barcodeType = url.searchParams.get("barcodeType") || "CODE128";
  const fontSize = url.searchParams.get("fontSize") || "medium";

  if (itemIds.length === 0)
    return NextResponse.json({ error: "No items selected" }, { status: 400 });

  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: itemIds }, createdById: (session.user as any).id },
  });

  if (items.length === 0)
    return NextResponse.json({ error: "No items found" }, { status: 404 });

  const label = LABEL_SIZES[size] || LABEL_SIZES["30252"];
  const barcodeHeight = BARCODE_HEIGHTS[size] || 18;
  const today = new Date().toLocaleDateString();

  const fontSizeMap: Record<string, string> = {
    small: "8pt",
    medium: "10pt",
    large: "12pt",
  };
  const nameFontSize = fontSizeMap[fontSize] || "10pt";

  const labels: string[] = [];
  for (const item of items) {
    for (let i = 0; i < copies; i++) {
      const parts: string[] = [];
      if (showName) {
        parts.push(`<div style="font-size: ${nameFontSize}; font-weight: bold; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.name)}</div>`);
      }
      if (showBarcode) {
        parts.push(`<svg class="barcode" data-barcode="${escapeHtml(item.barcode)}" data-format="${escapeHtml(barcodeType)}" data-height="${barcodeHeight}"></svg>`);
      }
      if (showLocation && item.location) {
        parts.push(`<div style="font-size: 8pt; color: #666;">${escapeHtml(item.location)}</div>`);
      }
      if (showQty) {
        parts.push(`<div style="font-size: 8pt;">Qty: ${item.quantity}</div>`);
      }
      if (showDate) {
        parts.push(`<div style="font-size: 7pt; color: #999;">${today}</div>`);
      }
      if (customText) {
        parts.push(`<div style="font-size: 8pt;">${escapeHtml(customText)}</div>`);
      }

      labels.push(
        `<div class="label" style="width: ${label.widthMM}mm; height: ${label.heightMM}mm; page-break-after: always; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2mm; box-sizing: border-box; font-family: Arial, sans-serif; gap: 1mm;">${parts.join("")}</div>`
      );
    }
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Print Labels</title>
<style>
  @page { size: ${label.widthMM}mm ${label.heightMM}mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; }
  .label:last-child { page-break-after: auto; }
  @media screen {
    body { background: #f0f0f0; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; }
    .label { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
  }
</style>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
</head>
<body>
${labels.join("\n")}
<script>
document.querySelectorAll('.barcode').forEach(function(el) {
  try {
    JsBarcode(el, el.dataset.barcode, {
      format: el.dataset.format,
      width: 2,
      height: parseInt(el.dataset.height),
      displayValue: true,
      fontSize: 10,
      margin: 2
    });
  } catch(e) {
    JsBarcode(el, el.dataset.barcode, {
      format: 'CODE128',
      width: 2,
      height: parseInt(el.dataset.height),
      displayValue: true,
      fontSize: 10,
      margin: 2
    });
  }
});
setTimeout(function() { window.print(); }, 500);
<\/script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const barcode = new URL(req.url).searchParams.get("barcode");
  if (!barcode)
    return NextResponse.json({ error: "Barcode required" }, { status: 400 });

  // Try Open Food Facts
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.status === 1 && data.product) {
        return NextResponse.json({
          name: data.product.product_name || barcode,
          description: data.product.generic_name || "",
          category: data.product.categories?.split(",")[0]?.trim() || "",
          source: "openfoodfacts",
        });
      }
    }
  } catch {}

  // Try UPC ItemDB
  try {
    const res = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        return NextResponse.json({
          name: item.title || barcode,
          description: item.description || "",
          category: item.category || "",
          source: "upcitemdb",
        });
      }
    }
  } catch {}

  // Fallback - use barcode as name
  return NextResponse.json({
    name: barcode,
    description: "",
    category: "",
    source: "none",
  });
}

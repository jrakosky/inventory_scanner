import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncItemToSage, testSageConnection } from "@/lib/sage";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Sync all inventory items to Sage Intacct
  const items = await prisma.inventoryItem.findMany();

  const results = {
    total: items.length,
    synced: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const item of items) {
    const result = await syncItemToSage({
      itemId: item.barcode,
      name: item.name,
      description: item.description || undefined,
      quantity: item.quantity,
      category: item.category || undefined,
    });

    if (result.success) {
      results.synced++;

      // Save the Sage item ID reference
      if (!item.sageItemId) {
        await prisma.inventoryItem.update({
          where: { id: item.id },
          data: { sageItemId: item.barcode },
        });
      }
    } else {
      results.failed++;
      results.errors.push(`${item.name}: ${result.response}`);
    }
  }

  return NextResponse.json({
    message: `Synced ${results.synced}/${results.total} items to Sage Intacct`,
    ...results,
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  if (searchParams.get("test") === "true") {
    const result = await testSageConnection();
    return NextResponse.json(result);
  }

  return NextResponse.json({ status: "ok" });
}

import { NextResponse } from "next/server";

export async function GET() {
  const csv = `barcode,name,description,quantity,location,category,condition,cost_price,min_stock
123456789012,Widget A,A standard widget,50,Warehouse A - Shelf 1,Widgets,GOOD,4.99,10
234567890123,Gadget B,Premium gadget,25,Warehouse B - Shelf 3,Gadgets,NEW,12.50,5
345678901234,Part C,Replacement part,100,Warehouse A - Shelf 5,Parts,GOOD,2.25,20`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="inventory-import-template.csv"',
    },
  });
}

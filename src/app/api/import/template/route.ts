import { NextResponse } from "next/server";

export async function GET() {
  const csv = `barcode,name,description,quantity,bin,row,aisle,zone,unit,category,condition,cost_price,min_stock
123456789012,Widget A,A standard widget,50,B-12,R-3,A-1,Zone A,each,Widgets,GOOD,4.99,10
234567890123,Gadget B,Premium gadget,25,B-5,R-1,A-2,Zone B,each,Gadgets,NEW,12.50,5
345678901234,Part C,Replacement part,100,B-20,R-7,A-1,Zone A,box,Parts,GOOD,2.25,20`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="inventory-import-template.csv"',
    },
  });
}

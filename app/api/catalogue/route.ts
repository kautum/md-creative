import { NextResponse } from "next/server";
import { getLiveCatalogue } from "@/lib/livePrices";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  return NextResponse.json(await getLiveCatalogue());
}

import { NextResponse } from "next/server";
import { fetchUsdRates } from "@/lib/billing/fx";
import { COFFEE } from "@/lib/billing/entitlements";

export const runtime = "nodejs";

export async function GET() {
  const rates = await fetchUsdRates();
  return NextResponse.json({ coffee: COFFEE, rates });
}

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { confirmCashfreeOrderPaid } from "@/lib/billing/cashfree";

export const runtime = "nodejs";

/**
 * Server-side order confirmation after return_url redirect.
 * Never trust the browser alone — re-fetch order from Cashfree.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderId = String(body.orderId || "").trim();
    if (!orderId) return apiError("orderId required");

    const result = await confirmCashfreeOrderPaid(orderId);
    return NextResponse.json({
      ok: true,
      paid: result.paid,
      recorded: result.recorded,
      status: result.status,
      entry: result.entry
        ? {
            displayName: result.entry.displayName,
            amountInr: result.entry.amountInr,
          }
        : undefined,
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Verify failed", 400);
  }
}

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import {
  applyCashfreeWebhook,
  verifyCashfreeWebhook,
} from "@/lib/billing/cashfree";

export const runtime = "nodejs";

/**
 * Cashfree webhook — Kind souls updates only after signature-verified success.
 * Configure this URL in Cashfree dashboard as notify_url / webhook.
 * @see https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  const timestamp = req.headers.get("x-webhook-timestamp");

  const verified = verifyCashfreeWebhook(raw, signature, timestamp);
  if (!verified.ok) {
    console.warn("Cashfree webhook rejected", verified.reason);
    return apiError(verified.reason, 400);
  }

  const result = applyCashfreeWebhook(raw);
  return NextResponse.json({
    received: true,
    recorded: result.recorded,
    type: result.type,
  });
}

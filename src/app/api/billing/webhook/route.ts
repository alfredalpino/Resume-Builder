import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import {
  applyRazorpayWebhookEvent,
  verifyRazorpayWebhook,
} from "@/lib/billing/razorpay";

export const runtime = "nodejs";

/** Razorpay webhook — Kind souls is updated only after verified payment. */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  const verified = verifyRazorpayWebhook(raw, signature);
  if (!verified.ok || !verified.event) {
    return apiError(verified.reason, 400);
  }

  const result = applyRazorpayWebhookEvent(verified.event);
  return NextResponse.json({
    received: true,
    recorded: result.recorded,
  });
}

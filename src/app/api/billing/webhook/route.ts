import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { verifyRazorpayWebhook } from "@/lib/billing/razorpay";

export const runtime = "nodejs";

/** Razorpay webhook — stub until merchant + RAZORPAY_WEBHOOK_SECRET are live. */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  const verified = verifyRazorpayWebhook(raw, signature);
  if (!verified.ok) {
    return apiError(verified.reason, 400);
  }
  return NextResponse.json({ received: true });
}

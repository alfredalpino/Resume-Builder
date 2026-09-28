/**
 * Razorpay stubs — activate when RAZORPAY_KEY_ID / SECRET are set.
 * Subscriptions: ₹50/mo Pro. Tips: one-shot payments for leaderboard.
 */

import { PRICING, razorpayConfigured } from "@/lib/billing/entitlements";

export type TipEntry = {
  displayName: string;
  amountInr: number;
  createdAt: string;
};

/** In-memory tip leaderboard until Neon is wired. */
const tipStore: TipEntry[] = [];

export function getTipLeaderboard(limit = 10): TipEntry[] {
  return [...tipStore].sort((a, b) => b.amountInr - a.amountInr).slice(0, limit);
}

export function recordTipStub(displayName: string, amountInr: number): TipEntry {
  const entry: TipEntry = {
    displayName: displayName.slice(0, 40) || "Anonymous",
    amountInr: Math.max(PRICING.tipMinInr, Math.round(amountInr)),
    createdAt: new Date().toISOString(),
  };
  tipStore.push(entry);
  return entry;
}

export type CheckoutIntent =
  | { ok: false; reason: string }
  | {
      ok: true;
      mode: "stub" | "live";
      kind: "pro_subscription" | "tip";
      amountInr: number;
      message: string;
      orderId?: string;
    };

export async function createProCheckout(_userEmail: string): Promise<CheckoutIntent> {
  if (!razorpayConfigured()) {
    return {
      ok: true,
      mode: "stub",
      kind: "pro_subscription",
      amountInr: PRICING.proMonthlyInr,
      message:
        "Razorpay is not configured yet. Pro checkout will activate when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set. Use ALFRED_FORCE_PRO=1 or ALFRED_PRO_EMAILS for testing.",
    };
  }

  // Live path placeholder — wire Orders API when merchant account is ready
  return {
    ok: true,
    mode: "live",
    kind: "pro_subscription",
    amountInr: PRICING.proMonthlyInr,
    message: "Create Razorpay subscription order (wire Orders API + webhook next).",
  };
}

export async function createTipCheckout(
  displayName: string,
  amountInr: number,
  optInLeaderboard: boolean,
): Promise<CheckoutIntent> {
  if (!razorpayConfigured()) {
    if (optInLeaderboard) {
      recordTipStub(displayName, amountInr);
    }
    return {
      ok: true,
      mode: "stub",
      kind: "tip",
      amountInr: Math.max(PRICING.tipMinInr, amountInr),
      message: optInLeaderboard
        ? "Tip recorded on local leaderboard (Razorpay not live yet)."
        : "Razorpay tip checkout will activate when keys are configured.",
    };
  }

  return {
    ok: true,
    mode: "live",
    kind: "tip",
    amountInr: Math.max(PRICING.tipMinInr, amountInr),
    message: "Create Razorpay payment link (wire when merchant ready).",
  };
}

/** Verify Razorpay webhook signature — stub until secrets exist. */
export function verifyRazorpayWebhook(
  _rawBody: string,
  _signature: string | null,
): { ok: boolean; reason: string } {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET?.trim()) {
    return { ok: false, reason: "RAZORPAY_WEBHOOK_SECRET not set" };
  }
  // Real HMAC verification goes here when live
  return { ok: false, reason: "Webhook verification not implemented — merchant pending" };
}

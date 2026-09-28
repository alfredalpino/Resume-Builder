/**
 * Buy-me-a-coffee tips via Razorpay (when configured).
 * Minimum $1 USD. No paid feature tiers — product is free.
 */

import { COFFEE, razorpayConfigured } from "@/lib/billing/entitlements";

export type TipEntry = {
  displayName: string;
  amountUsd: number;
  createdAt: string;
};

const tipStore: TipEntry[] = [];

export function getTipLeaderboard(limit = 10): TipEntry[] {
  return [...tipStore].sort((a, b) => b.amountUsd - a.amountUsd).slice(0, limit);
}

export function recordTipStub(displayName: string, amountUsd: number): TipEntry {
  const entry: TipEntry = {
    displayName: displayName.slice(0, 40) || "Anonymous",
    amountUsd: Math.max(COFFEE.tipMinUsd, Math.round(amountUsd * 100) / 100),
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
      kind: "coffee";
      amountUsd: number;
      message: string;
      orderId?: string;
    };

export async function createCoffeeCheckout(
  displayName: string,
  amountUsd: number,
  optInLeaderboard: boolean,
): Promise<CheckoutIntent> {
  const amount = Math.max(COFFEE.tipMinUsd, Math.round(amountUsd * 100) / 100);

  if (!razorpayConfigured()) {
    if (optInLeaderboard) {
      recordTipStub(displayName, amount);
    }
    return {
      ok: true,
      mode: "stub",
      kind: "coffee",
      amountUsd: amount,
      message: optInLeaderboard
        ? "Thanks — recorded on the leaderboard (payments go live when Razorpay is connected)."
        : "Thanks for the thought. Checkout will open when Razorpay is connected.",
    };
  }

  return {
    ok: true,
    mode: "live",
    kind: "coffee",
    amountUsd: amount,
    message: "Create Razorpay payment (wire Orders API when merchant ready).",
  };
}

export function verifyRazorpayWebhook(
  _rawBody: string,
  _signature: string | null,
): { ok: boolean; reason: string } {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET?.trim()) {
    return { ok: false, reason: "RAZORPAY_WEBHOOK_SECRET not set" };
  }
  return { ok: false, reason: "Webhook verification not implemented — merchant pending" };
}

/**
 * Buy-me-a-coffee tips via Razorpay (when configured).
 * Leaderboard only lists tips after payment is confirmed (webhook).
 */

import crypto from "crypto";
import { COFFEE, razorpayConfigured } from "@/lib/billing/entitlements";

export type TipEntry = {
  displayName: string;
  amountUsd: number;
  createdAt: string;
  paymentId?: string;
};

const tipStore: TipEntry[] = [];

export function getTipLeaderboard(limit = 10): TipEntry[] {
  return [...tipStore].sort((a, b) => b.amountUsd - a.amountUsd).slice(0, limit);
}

/** Only call after a verified successful payment. */
export function recordConfirmedTip(
  displayName: string,
  amountUsd: number,
  paymentId?: string,
): TipEntry {
  if (paymentId && tipStore.some((t) => t.paymentId === paymentId)) {
    return tipStore.find((t) => t.paymentId === paymentId)!;
  }
  const entry: TipEntry = {
    displayName: displayName.slice(0, 40) || "Anonymous",
    amountUsd: Math.max(COFFEE.tipMinUsd, Math.round(amountUsd * 100) / 100),
    createdAt: new Date().toISOString(),
    paymentId,
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
      razorpayKeyId?: string;
    };

export async function createCoffeeCheckout(
  displayName: string,
  amountUsd: number,
  _optInLeaderboard: boolean,
): Promise<CheckoutIntent> {
  const amount = Math.max(COFFEE.tipMinUsd, Math.round(amountUsd * 100) / 100);
  const name = displayName.slice(0, 40) || "Anonymous";

  if (!razorpayConfigured()) {
    // Never write to leaderboard without a confirmed payment.
    return {
      ok: true,
      mode: "stub",
      kind: "coffee",
      amountUsd: amount,
      message:
        "Checkout isn’t live yet. Kind souls only lists confirmed coffees — nothing was charged or listed.",
    };
  }

  const keyId = process.env.RAZORPAY_KEY_ID!.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET!.trim();
  const amountPaise = Math.round(amount * 100); // USD cents if account is USD; merchant may use INR

  try {
    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "USD",
        receipt: `coffee_${Date.now()}`,
        notes: {
          kind: "coffee",
          displayName: name,
          amountUsd: String(amount),
          optInLeaderboard: "true",
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Razorpay order failed", res.status, text);
      return {
        ok: false,
        reason: "Couldn’t start checkout. Try again in a moment.",
      };
    }

    const order = (await res.json()) as { id: string };
    return {
      ok: true,
      mode: "live",
      kind: "coffee",
      amountUsd: amount,
      orderId: order.id,
      razorpayKeyId: keyId,
      message: "Complete payment in the checkout window. You’ll appear on Kind souls after it succeeds.",
    };
  } catch (err) {
    console.error("Razorpay order error", err);
    return {
      ok: false,
      reason: "Couldn’t start checkout. Try again in a moment.",
    };
  }
}

export function verifyRazorpayWebhook(
  rawBody: string,
  signature: string | null,
): { ok: boolean; reason: string; event?: RazorpayWebhookEvent } {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return { ok: false, reason: "RAZORPAY_WEBHOOK_SECRET not set" };
  }
  if (!signature) {
    return { ok: false, reason: "Missing signature" };
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "Invalid signature" };
  }

  try {
    const event = JSON.parse(rawBody) as RazorpayWebhookEvent;
    return { ok: true, reason: "verified", event };
  } catch {
    return { ok: false, reason: "Invalid JSON body" };
  }
}

type RazorpayWebhookEvent = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        notes?: Record<string, string>;
        order_id?: string;
      };
    };
    order?: {
      entity?: {
        id?: string;
        amount?: number;
        notes?: Record<string, string>;
      };
    };
  };
};

/** Apply a verified webhook — record tip only on captured/paid events. */
export function applyRazorpayWebhookEvent(event: RazorpayWebhookEvent): {
  recorded: boolean;
  entry?: TipEntry;
} {
  const type = event.event || "";
  const payment = event.payload?.payment?.entity;
  const order = event.payload?.order?.entity;

  if (type === "payment.captured" && payment?.status === "captured") {
    const notes = payment.notes || {};
    const name = notes.displayName || "Anonymous";
    const amountUsd = notes.amountUsd
      ? Number(notes.amountUsd)
      : payment.currency === "USD" && payment.amount
        ? payment.amount / 100
        : COFFEE.tipMinUsd;
    if (!Number.isFinite(amountUsd) || amountUsd < COFFEE.tipMinUsd) {
      return { recorded: false };
    }
    const entry = recordConfirmedTip(name, amountUsd, payment.id);
    return { recorded: true, entry };
  }

  if (type === "order.paid" && order) {
    const notes = order.notes || {};
    const name = notes.displayName || "Anonymous";
    const amountUsd = notes.amountUsd
      ? Number(notes.amountUsd)
      : order.amount
        ? order.amount / 100
        : COFFEE.tipMinUsd;
    if (!Number.isFinite(amountUsd) || amountUsd < COFFEE.tipMinUsd) {
      return { recorded: false };
    }
    const entry = recordConfirmedTip(name, amountUsd, order.id);
    return { recorded: true, entry };
  }

  return { recorded: false };
}

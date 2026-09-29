/**
 * Cashfree Payment Gateway — Buy me a coffee tips.
 * Docs: https://www.cashfree.com/docs/payments/online/web/redirect
 *
 * Secrets stay server-side (CASHFREE_APP_ID / CASHFREE_SECRET_KEY).
 * Leaderboard updates only after verified webhook or server-side order PAID check.
 */
import crypto from "crypto";
import { COFFEE, cashfreeConfigured } from "@/lib/billing/entitlements";
import { recordConfirmedTip, type TipEntry } from "@/lib/billing/tips-store";

export { getTipLeaderboard, recordConfirmedTip, type TipEntry } from "@/lib/billing/tips-store";

const API_VERSION = "2025-01-01";

export function cashfreeBaseUrl(): string {
  const env = (process.env.CASHFREE_ENV || "sandbox").trim().toLowerCase();
  return env === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";
}

export function cashfreeJsMode(): "sandbox" | "production" {
  const env = (process.env.CASHFREE_ENV || "sandbox").trim().toLowerCase();
  return env === "production" ? "production" : "sandbox";
}

function appOrigin(): string {
  return (
    process.env.AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-version": API_VERSION,
    "x-client-id": process.env.CASHFREE_APP_ID!.trim(),
    "x-client-secret": process.env.CASHFREE_SECRET_KEY!.trim(),
  };
}

export type CashfreeCheckoutResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      mode: "stub" | "live";
      provider: "cashfree";
      kind: "coffee";
      amountInr: number;
      orderId?: string;
      paymentSessionId?: string;
      cashfreeEnv?: "sandbox" | "production";
      message: string;
    };

function sanitizeAmountInr(raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  const amount = Math.round(raw * 100) / 100;
  if (amount < COFFEE.tipMinInr) return null;
  if (amount > COFFEE.tipMaxInr) return null;
  return amount;
}

export async function createCashfreeCoffeeOrder(input: {
  displayName: string;
  amountInr: number;
  customerEmail?: string;
  customerPhone?: string;
}): Promise<CashfreeCheckoutResult> {
  const amount = sanitizeAmountInr(input.amountInr);
  if (amount == null) {
    return {
      ok: false,
      reason: `Amount must be between ₹${COFFEE.tipMinInr} and ₹${COFFEE.tipMaxInr}`,
    };
  }

  const name = input.displayName.slice(0, 40) || "Anonymous";

  if (!cashfreeConfigured()) {
    return {
      ok: true,
      mode: "stub",
      provider: "cashfree",
      kind: "coffee",
      amountInr: amount,
      message:
        "Checkout isn’t live yet. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY. Kind souls only lists confirmed payments.",
    };
  }

  const orderId = `at_coffee_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const origin = appOrigin();
  const returnUrl = `${origin}/coffee?order_id=${encodeURIComponent(orderId)}`;
  const notifyUrl = `${origin}/api/payments/webhook`;

  const phoneDigits = (input.customerPhone || "").replace(/\D/g, "");
  const customerPhone =
    phoneDigits.length >= 10 ? phoneDigits.slice(-10) : "9999999999";

  try {
    const res = await fetch(`${cashfreeBaseUrl()}/orders`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: `guest_${crypto.randomBytes(6).toString("hex")}`,
          customer_name: name,
          customer_email: input.customerEmail || "support@alfredterminal.xyz",
          customer_phone: customerPhone,
        },
        order_meta: {
          return_url: returnUrl,
          notify_url: notifyUrl,
        },
        order_note: "Alfred Terminal coffee tip",
        order_tags: {
          kind: "coffee",
          displayName: name,
          amountInr: String(amount),
          checkout_context: "Support Alfred Terminal",
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Cashfree create order failed", res.status, text);
      return {
        ok: false,
        reason: "Couldn’t start checkout. Try again in a moment.",
      };
    }

    const data = (await res.json()) as {
      order_id?: string;
      payment_session_id?: string;
    };

    if (!data.payment_session_id) {
      console.error("Cashfree order missing payment_session_id", data);
      return { ok: false, reason: "Couldn’t start checkout. Try again." };
    }

    return {
      ok: true,
      mode: "live",
      provider: "cashfree",
      kind: "coffee",
      amountInr: amount,
      orderId: data.order_id || orderId,
      paymentSessionId: data.payment_session_id,
      cashfreeEnv: cashfreeJsMode(),
      message:
        "Complete payment in checkout. You’ll appear on Kind souls after Cashfree confirms it.",
    };
  } catch (err) {
    console.error("Cashfree create order error", err);
    return {
      ok: false,
      reason: "Couldn’t start checkout. Try again in a moment.",
    };
  }
}

export type CashfreeOrderStatus = {
  orderId: string;
  orderStatus: string;
  orderAmount: number;
  orderCurrency: string;
  displayName?: string;
  paid: boolean;
};

export async function fetchCashfreeOrder(
  orderId: string,
): Promise<CashfreeOrderStatus | null> {
  if (!cashfreeConfigured() || !orderId) return null;
  try {
    const res = await fetch(
      `${cashfreeBaseUrl()}/orders/${encodeURIComponent(orderId)}`,
      { headers: authHeaders(), method: "GET" },
    );
    if (!res.ok) {
      console.error("Cashfree fetch order failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as {
      order_id?: string;
      order_status?: string;
      order_amount?: number;
      order_currency?: string;
      order_tags?: Record<string, string>;
    };
    const status = (data.order_status || "").toUpperCase();
    return {
      orderId: data.order_id || orderId,
      orderStatus: status,
      orderAmount: Number(data.order_amount) || 0,
      orderCurrency: data.order_currency || "INR",
      displayName: data.order_tags?.displayName,
      paid: status === "PAID",
    };
  } catch (err) {
    console.error("Cashfree fetch order error", err);
    return null;
  }
}

/**
 * Verify webhook: HMAC-SHA256(timestamp + rawBody, secret) → base64
 * Headers: x-webhook-timestamp, x-webhook-signature
 * @see https://www.cashfree.com/docs/payments/online/webhooks/signature-verification
 */
export function verifyCashfreeWebhook(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
): { ok: boolean; reason: string } {
  const secret = process.env.CASHFREE_SECRET_KEY?.trim();
  if (!secret) return { ok: false, reason: "CASHFREE_SECRET_KEY not set" };
  if (!signature || !timestamp) {
    return { ok: false, reason: "Missing webhook signature or timestamp" };
  }

  const signedPayload = `${timestamp}${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: "Invalid webhook signature" };
  }
  return { ok: true, reason: "verified" };
}

type CashfreeWebhookPayload = {
  type?: string;
  data?: {
    order?: {
      order_id?: string;
      order_amount?: number;
      order_currency?: string;
      order_tags?: Record<string, string>;
    };
    payment?: {
      cf_payment_id?: string;
      payment_status?: string;
      payment_amount?: number;
    };
  };
};

/** Apply verified Cashfree webhook — record tip only on successful payment. */
export function applyCashfreeWebhook(rawBody: string): {
  recorded: boolean;
  entry?: TipEntry;
  type?: string;
} {
  let payload: CashfreeWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as CashfreeWebhookPayload;
  } catch {
    return { recorded: false };
  }

  const type = (payload.type || "").toUpperCase();
  const paymentStatus = (payload.data?.payment?.payment_status || "").toUpperCase();
  const success =
    type.includes("PAYMENT_SUCCESS") ||
    type === "PAYMENT_SUCCESS_WEBHOOK" ||
    paymentStatus === "SUCCESS" ||
    paymentStatus === "PAID";

  if (!success) {
    return { recorded: false, type };
  }

  const order = payload.data?.order;
  const payment = payload.data?.payment;
  const tags = order?.order_tags || {};
  const name = tags.displayName || "Anonymous";
  const amountInr = tags.amountInr
    ? Number(tags.amountInr)
    : Number(order?.order_amount ?? payment?.payment_amount ?? 0);

  if (!Number.isFinite(amountInr) || amountInr < COFFEE.tipMinInr) {
    return { recorded: false, type };
  }

  const paymentId = payment?.cf_payment_id || order?.order_id;
  const entry = recordConfirmedTip({
    displayName: name,
    amountInr,
    paymentId,
    provider: "cashfree",
  });
  return { recorded: true, entry, type };
}

/** Confirm return_url visit by fetching order status server-side. */
export async function confirmCashfreeOrderPaid(orderId: string): Promise<{
  recorded: boolean;
  paid: boolean;
  entry?: TipEntry;
  status?: string;
}> {
  const order = await fetchCashfreeOrder(orderId);
  if (!order) return { recorded: false, paid: false };
  if (!order.paid) {
    return { recorded: false, paid: false, status: order.orderStatus };
  }
  const entry = recordConfirmedTip({
    displayName: order.displayName || "Anonymous",
    amountInr: order.orderAmount,
    paymentId: order.orderId,
    provider: "cashfree",
  });
  return { recorded: true, paid: true, entry, status: order.orderStatus };
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { COFFEE, cashfreeConfigured } from "@/lib/billing/entitlements";
import { createCashfreeCoffeeOrder } from "@/lib/billing/cashfree";

export const runtime = "nodejs";

/**
 * Create Cashfree order for Buy me a coffee.
 * Returns payment_session_id for client SDK — never returns secret key.
 * @see https://www.cashfree.com/docs/payments/online/web/redirect
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();
    const amountInr = Number(body.amountInr ?? body.amount);
    if (!Number.isFinite(amountInr)) {
      return apiError("Invalid amount");
    }
    if (amountInr < COFFEE.tipMinInr) {
      return apiError(`Minimum is ₹${COFFEE.tipMinInr}`);
    }
    if (amountInr > COFFEE.tipMaxInr) {
      return apiError(`Maximum is ₹${COFFEE.tipMaxInr}`);
    }

    const intent = await createCashfreeCoffeeOrder({
      displayName: String(
        body.displayName || session?.user?.name || "Anonymous",
      ),
      amountInr,
      customerEmail:
        typeof body.email === "string"
          ? body.email
          : session?.user?.email || undefined,
      customerPhone: typeof body.phone === "string" ? body.phone : undefined,
    });

    if (!intent.ok) {
      return apiError(intent.reason, 400);
    }

    return NextResponse.json({
      ...intent,
      cashfreeReady: cashfreeConfigured(),
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Checkout failed", 400);
  }
}

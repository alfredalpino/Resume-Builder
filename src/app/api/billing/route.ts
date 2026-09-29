import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import {
  getEntitlements,
  COFFEE,
  cashfreeConfigured,
  razorpayConfigured,
} from "@/lib/billing/entitlements";
import { createCashfreeCoffeeOrder, getTipLeaderboard } from "@/lib/billing/cashfree";
import { fetchUsdRates } from "@/lib/billing/fx";

export const runtime = "nodejs";

export async function GET() {
  const rates = await fetchUsdRates();
  const session = await auth();
  return NextResponse.json({
    coffee: COFFEE,
    rates,
    leaderboard: getTipLeaderboard(20),
    cashfreeReady: cashfreeConfigured(),
    razorpayReady: razorpayConfigured(),
    entitlements: session?.user ? getEntitlements(session.user.email) : null,
  });
}

/**
 * Coffee tips — prefers Cashfree (amountInr). Auth optional.
 * Leaderboard updates only after payment webhook / verify.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();

    // Prefer INR (Cashfree). Fall back to USD→INR approx for old clients.
    let amountInr = Number(body.amountInr);
    if (!Number.isFinite(amountInr) && Number.isFinite(Number(body.amountUsd))) {
      amountInr = Math.round(Number(body.amountUsd) * 83);
    }

    if (!Number.isFinite(amountInr) || amountInr < COFFEE.tipMinInr) {
      return apiError(`Minimum is ₹${COFFEE.tipMinInr}`);
    }
    if (amountInr > COFFEE.tipMaxInr) {
      return apiError(`Maximum is ₹${COFFEE.tipMaxInr}`);
    }

    const intent = await createCashfreeCoffeeOrder({
      displayName: String(body.displayName || session?.user?.name || "Anonymous"),
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
    return NextResponse.json(intent);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Checkout failed", 400);
  }
}

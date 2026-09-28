import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { apiError } from "@/lib/api";
import { getEntitlements, COFFEE } from "@/lib/billing/entitlements";
import { createCoffeeCheckout, getTipLeaderboard } from "@/lib/billing/razorpay";
import { fetchUsdRates } from "@/lib/billing/fx";

export const runtime = "nodejs";

export async function GET() {
  const rates = await fetchUsdRates();
  const session = await auth();
  return NextResponse.json({
    coffee: COFFEE,
    rates,
    leaderboard: getTipLeaderboard(10),
    entitlements: session?.user ? getEntitlements(session.user.email) : null,
  });
}

/** Coffee tips — no paid features; auth optional. */
export async function POST(req: Request) {
  try {
    const session = await auth();
    const body = await req.json();
    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < COFFEE.tipMinUsd) {
      return apiError(`Minimum is $${COFFEE.tipMinUsd}`);
    }
    const intent = await createCoffeeCheckout(
      String(body.displayName || session?.user?.name || "Anonymous"),
      amountUsd,
      body.optInLeaderboard !== false,
    );
    return NextResponse.json(intent);
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Checkout failed", 400);
  }
}

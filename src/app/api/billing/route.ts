import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireSession, apiError } from "@/lib/api";
import { getEntitlements, PRICING } from "@/lib/billing/entitlements";
import {
  createProCheckout,
  createTipCheckout,
  getTipLeaderboard,
} from "@/lib/billing/razorpay";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  const session = await auth();
  return NextResponse.json({
    entitlements: getEntitlements(session?.user?.email),
    pricing: PRICING,
    leaderboard: getTipLeaderboard(10),
  });
}

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;
  const session = await auth();
  try {
    const body = await req.json();
    const action = String(body.action || "");
    if (action === "pro") {
      const intent = await createProCheckout(session?.user?.email || "");
      return NextResponse.json(intent);
    }
    if (action === "tip") {
      const intent = await createTipCheckout(
        String(body.displayName || session?.user?.name || "Anonymous"),
        Number(body.amountInr) || PRICING.tipMinInr,
        Boolean(body.optInLeaderboard),
      );
      return NextResponse.json(intent);
    }
    return apiError("Unknown action");
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Billing failed", 400);
  }
}

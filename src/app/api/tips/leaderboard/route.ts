import { NextResponse } from "next/server";
import { getTipLeaderboard } from "@/lib/billing/razorpay";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ leaderboard: getTipLeaderboard(20) });
}

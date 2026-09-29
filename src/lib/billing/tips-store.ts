/**
 * Shared tip leaderboard store.
 * Only write via recordConfirmedTip after verified payment (Cashfree / Razorpay webhook).
 */

export type TipEntry = {
  displayName: string;
  /** Primary display amount in INR (Cashfree). */
  amountInr: number;
  /** Legacy USD field for older Razorpay tips / approximate display. */
  amountUsd: number;
  createdAt: string;
  paymentId?: string;
  provider?: "cashfree" | "razorpay";
};

const tipStore: TipEntry[] = [];

export function getTipLeaderboard(limit = 10): TipEntry[] {
  return [...tipStore]
    .sort((a, b) => b.amountInr - a.amountInr || b.amountUsd - a.amountUsd)
    .slice(0, limit);
}

/** Only call after a verified successful payment. Idempotent on paymentId. */
export function recordConfirmedTip(input: {
  displayName: string;
  amountInr: number;
  amountUsd?: number;
  paymentId?: string;
  provider?: "cashfree" | "razorpay";
}): TipEntry {
  if (input.paymentId && tipStore.some((t) => t.paymentId === input.paymentId)) {
    return tipStore.find((t) => t.paymentId === input.paymentId)!;
  }
  const amountInr = Math.max(1, Math.round(input.amountInr * 100) / 100);
  const entry: TipEntry = {
    displayName: input.displayName.slice(0, 40) || "Anonymous",
    amountInr,
    amountUsd:
      input.amountUsd != null
        ? Math.max(0.01, Math.round(input.amountUsd * 100) / 100)
        : Math.round((amountInr / 83) * 100) / 100,
    createdAt: new Date().toISOString(),
    paymentId: input.paymentId,
    provider: input.provider,
  };
  tipStore.push(entry);
  return entry;
}

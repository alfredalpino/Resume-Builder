/**
 * Everything is free for everyone.
 * Optional "Buy me a coffee" tips start at $1 USD — never gates features.
 */

export type Entitlements = {
  hardIntensity: boolean;
  claudeWriter: boolean;
  unlimitedCoverLetters: boolean;
  docxExport: boolean;
  tipsEnabled: boolean;
  razorpayReady: boolean;
};

export function razorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim(),
  );
}

/** All product features unlocked. Claude only needs a server key to run. */
export function getEntitlements(_userEmail?: string | null): Entitlements {
  return {
    hardIntensity: true,
    claudeWriter: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    unlimitedCoverLetters: true,
    docxExport: true,
    tipsEnabled: true,
    razorpayReady: razorpayConfigured(),
  };
}

export const COFFEE = {
  tipMinUsd: 1,
  currency: "USD",
  /** Currencies to show live equivalents for (Frankfurter-supported). */
  displayCurrencies: ["INR", "EUR", "GBP", "AED", "CAD", "AUD", "SGD", "JPY"] as const,
} as const;

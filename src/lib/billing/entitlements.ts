/**
 * Everything is free for everyone.
 * Optional "Buy me a coffee" tips via Cashfree (INR) — never gates features.
 */

export type Entitlements = {
  hardIntensity: boolean;
  /** AI writer available when OpenRouter or Anthropic key is set. */
  aiWriter: boolean;
  /** @deprecated alias of aiWriter */
  claudeWriter: boolean;
  unlimitedCoverLetters: boolean;
  docxExport: boolean;
  tipsEnabled: boolean;
  razorpayReady: boolean;
  cashfreeReady: boolean;
};

export function razorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim(),
  );
}

export function cashfreeConfigured(): boolean {
  const secret =
    process.env.CASHFREE_SECRET_KEY?.trim() ||
    process.env.CASHFREE_APP_SECRET_KEY?.trim();
  return Boolean(process.env.CASHFREE_APP_ID?.trim() && secret);
}

function hasAiWriterKey(): boolean {
  return Boolean(
    process.env.OPENROUTER_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim(),
  );
}

/** All product features unlocked. AI writer only needs a server key to run. */
export function getEntitlements(_userEmail?: string | null): Entitlements {
  const ai = hasAiWriterKey();
  return {
    hardIntensity: true,
    aiWriter: ai,
    claudeWriter: ai,
    unlimitedCoverLetters: true,
    docxExport: true,
    tipsEnabled: true,
    razorpayReady: razorpayConfigured(),
    cashfreeReady: cashfreeConfigured(),
  };
}

export const COFFEE = {
  /** Cashfree primary — INR */
  tipMinInr: 50,
  tipMaxInr: 50_000,
  currency: "INR",
  presetsInr: [50, 100, 250, 500] as const,
  /** Legacy USD floor (Razorpay path) */
  tipMinUsd: 1,
  /** Currencies to show live equivalents for (Frankfurter-supported). */
  displayCurrencies: ["INR", "EUR", "GBP", "AED", "CAD", "AUD", "SGD", "JPY"] as const,
} as const;

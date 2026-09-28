/**
 * Entitlements — FREE by default until Razorpay is live.
 * Pro unlocks Hard intensity, Claude writer, unlimited cover letters, DOCX.
 */

export type PlanTier = "free" | "pro";

export type Entitlements = {
  tier: PlanTier;
  hardIntensity: boolean;
  claudeWriter: boolean;
  unlimitedCoverLetters: boolean;
  docxExport: boolean;
  coverLettersRemaining: number;
  tipsEnabled: boolean;
  razorpayReady: boolean;
};

const PRO_EMAILS = (process.env.ALFRED_PRO_EMAILS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function razorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim(),
  );
}

export function getEntitlements(userEmail?: string | null): Entitlements {
  const email = (userEmail || "").toLowerCase();
  const forcePro =
    process.env.ALFRED_FORCE_PRO === "1" || (email && PRO_EMAILS.includes(email));
  // Until Razorpay is live, Hard stays available so quality work can be tested;
  // Claude still requires ANTHROPIC_API_KEY. Flip ALFRED_GATE_HARD=1 to enforce Pro.
  const gateHard = process.env.ALFRED_GATE_HARD === "1";
  const tier: PlanTier = forcePro ? "pro" : "free";
  const isPro = tier === "pro";

  return {
    tier,
    hardIntensity: isPro || !gateHard,
    claudeWriter: isPro && Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    unlimitedCoverLetters: isPro,
    docxExport: true,
    coverLettersRemaining: isPro ? 999 : 5,
    tipsEnabled: true,
    razorpayReady: razorpayConfigured(),
  };
}

export const PRICING = {
  proMonthlyInr: 50,
  currency: "INR",
  tipMinInr: 10,
} as const;

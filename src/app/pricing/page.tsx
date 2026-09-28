import Link from "next/link";
import { PricingClient } from "@/components/pricing-client";
import { PRICING } from "@/lib/billing/entitlements";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--terminal-black)] text-[var(--terminal-white)]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="font-mono text-[var(--alfred-amber)]">&gt;_</span>
          Alfred Terminal
        </Link>
        <Link href="/app" className="text-sm text-[var(--terminal-gray)] hover:text-[var(--alfred-amber)]">
          Open app
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--alfred-amber)]">
          Pricing
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Simple pricing. Honest product.
        </h1>
        <p className="mt-3 max-w-xl text-[var(--terminal-gray)]">
          Free forever for Subtle and Medium. Pro is ₹{PRICING.proMonthlyInr}/month for Hard
          intensity, Claude writing when configured, and unlimited cover letters. Tips support the
          product — and top supporters appear on the leaderboard.
        </p>
        <PricingClient />
      </main>
    </div>
  );
}

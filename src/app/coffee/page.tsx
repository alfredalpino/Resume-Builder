import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { CoffeeClient } from "@/components/coffee-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { COFFEE } from "@/lib/billing/entitlements";

const quoteFont = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-quote",
  display: "swap",
});

export default function CoffeePage() {
  return (
    <div className={`${quoteFont.variable} min-h-screen bg-[var(--bg)] text-[var(--text)]`}>
      <header className="mx-auto flex max-w-lg items-center justify-between px-6 py-8">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="font-mono text-[var(--alfred-amber)]">&gt;_</span>
          Alfred Terminal
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--alfred-amber)]"
          >
            Back to app
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-lg px-6 pb-24">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--alfred-amber)]">
          Support
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Buy me a coffee
        </h1>
        <p className="mt-3 text-[var(--text-secondary)]">
          Alfred Terminal is free. If it helped you, a coffee starting at ₹{COFFEE.tipMinInr} means a
          lot.
        </p>
        <CoffeeClient />
      </main>
    </div>
  );
}

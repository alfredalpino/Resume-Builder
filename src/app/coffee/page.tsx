import Link from "next/link";
import { CoffeeClient } from "@/components/coffee-client";
import { COFFEE } from "@/lib/billing/entitlements";

export default function CoffeePage() {
  return (
    <div className="min-h-screen bg-[var(--terminal-black)] text-[var(--terminal-white)]">
      <header className="mx-auto flex max-w-lg items-center justify-between px-6 py-8">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="font-mono text-[var(--alfred-amber)]">&gt;_</span>
          Alfred Terminal
        </Link>
        <Link
          href="/app"
          className="text-sm text-[var(--terminal-gray)] hover:text-[var(--alfred-amber)]"
        >
          Back to app
        </Link>
      </header>

      <main className="mx-auto max-w-lg px-6 pb-24">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--alfred-amber)]">
          Support
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Buy me a coffee
        </h1>
        <p className="mt-3 text-[var(--terminal-gray)]">
          Alfred Terminal is free. If it helped you, a coffee starting at ${COFFEE.tipMinUsd} means a
          lot.
        </p>
        <CoffeeClient />
      </main>
    </div>
  );
}

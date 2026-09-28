"use client";

import { useEffect, useState } from "react";
import { PRICING } from "@/lib/billing/entitlements";

type LeaderEntry = { displayName: string; amountInr: number; createdAt: string };

export function PricingClient() {
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [tipName, setTipName] = useState("");
  const [tipAmount, setTipAmount] = useState(50);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/tips/leaderboard");
      if (!res.ok) return;
      const data = (await res.json()) as { leaderboard: LeaderEntry[] };
      setLeaderboard(data.leaderboard || []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function checkout(action: "pro" | "tip") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "pro"
            ? { action: "pro" }
            : {
                action: "tip",
                displayName: tipName || "Anonymous",
                amountInr: tipAmount,
                optInLeaderboard: true,
              },
        ),
      });
      const data = (await res.json()) as { message?: string; error?: string; ok?: boolean };
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessage(data.message || "Done");
      if (action === "tip") await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed — sign in required for checkout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-5">
          <p className="text-sm text-[var(--terminal-gray)]">Free</p>
          <p className="mt-1 text-3xl font-semibold">₹0</p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--terminal-gray)]">
            <li>Resume Tailor — Subtle & Medium</li>
            <li>PDF download</li>
            <li>Limited cover letters</li>
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--alfred-amber)]/40 bg-[var(--terminal-surface)] p-5">
          <p className="text-sm text-[var(--alfred-amber)]">Pro</p>
          <p className="mt-1 text-3xl font-semibold">
            ₹{PRICING.proMonthlyInr}
            <span className="text-base font-normal text-[var(--terminal-gray)]">/mo</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--terminal-gray)]">
            <li>Hard intensity pivot</li>
            <li>Claude writer when configured</li>
            <li>Unlimited cover letters · DOCX</li>
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => checkout("pro")}
            className="mt-5 w-full rounded-lg bg-[var(--alfred-amber)] px-4 py-2.5 text-sm font-medium text-[var(--terminal-black)] disabled:opacity-50"
          >
            {busy ? "Working…" : "Get Pro"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-5">
        <h2 className="text-lg font-medium">Support Alfred</h2>
        <p className="mt-1 text-sm text-[var(--terminal-gray)]">
          Tip any amount (buy-me-a-coffee style). Opt in to the public max-payer leaderboard.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-elevated)] px-3 py-2 text-sm"
            placeholder="Display name"
            value={tipName}
            onChange={(e) => setTipName(e.target.value)}
          />
          <input
            type="number"
            min={PRICING.tipMinInr}
            className="w-28 rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-elevated)] px-3 py-2 text-sm"
            value={tipAmount}
            onChange={(e) => setTipAmount(Number(e.target.value))}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => checkout("tip")}
            className="rounded-lg border border-[var(--alfred-amber)]/50 px-4 py-2 text-sm text-[var(--alfred-amber)] disabled:opacity-50"
          >
            Tip ₹{tipAmount}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-5">
        <h2 className="text-lg font-medium">Leaderboard</h2>
        <p className="mt-1 text-xs text-[var(--terminal-muted)]">Highest supporters (opt-in)</p>
        <ol className="mt-4 space-y-2">
          {leaderboard.length === 0 ? (
            <li className="text-sm text-[var(--terminal-muted)]">No tips yet — be the first.</li>
          ) : (
            leaderboard.map((e, i) => (
              <li
                key={`${e.displayName}-${e.createdAt}`}
                className="flex justify-between text-sm text-[var(--terminal-gray)]"
              >
                <span>
                  {i + 1}. {e.displayName}
                </span>
                <span className="font-mono text-[var(--alfred-amber)]">₹{e.amountInr}</span>
              </li>
            ))
          )}
        </ol>
      </div>

      {message ? (
        <p className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-elevated)] px-4 py-3 text-sm text-[var(--terminal-gray)]">
          {message}
        </p>
      ) : null}
    </div>
  );
}

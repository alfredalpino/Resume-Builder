"use client";

import { useEffect, useMemo, useState } from "react";
import { COFFEE } from "@/lib/billing/entitlements";

type LeaderEntry = { displayName: string; amountUsd: number; createdAt: string };
type Rates = { date: string; rates: Record<string, number> };

const PRESETS = [1, 3, 5, 10];

function formatLocal(amountUsd: number, currency: string, rate: number): string {
  const local = amountUsd * rate;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(local);
  } catch {
    return `${local.toFixed(2)} ${currency}`;
  }
}

export function CoffeeClient() {
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [rates, setRates] = useState<Rates | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(1);
  const [currency, setCurrency] = useState("INR");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/billing");
      if (!res.ok) {
        const fx = await fetch("/api/fx");
        if (fx.ok) {
          const data = (await fx.json()) as { rates: Rates };
          setRates(data.rates);
        }
        return;
      }
      const data = (await res.json()) as {
        leaderboard: LeaderEntry[];
        rates: Rates;
      };
      setLeaderboard(data.leaderboard || []);
      setRates(data.rates);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const localHint = useMemo(() => {
    if (!rates?.rates?.[currency]) return null;
    return formatLocal(amount, currency, rates.rates[currency]);
  }, [amount, currency, rates]);

  async function sendCoffee() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name || "Anonymous",
          amountUsd: amount,
          optInLeaderboard: true,
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setMessage(data.message || "Thank you.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-12 space-y-10">
      <div className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-8">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              className={`rounded-full px-4 py-1.5 text-sm ${
                amount === p
                  ? "bg-[var(--alfred-amber)] text-[var(--terminal-black)]"
                  : "border border-[var(--terminal-border)] text-[var(--terminal-gray)] hover:border-[var(--alfred-amber)]/40"
              }`}
            >
              ${p}
            </button>
          ))}
        </div>

        <label className="mt-6 block text-xs uppercase tracking-wide text-[var(--terminal-muted)]">
          Amount (USD)
          <input
            type="number"
            min={COFFEE.tipMinUsd}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Math.max(COFFEE.tipMinUsd, Number(e.target.value) || COFFEE.tipMinUsd))}
            className="mt-2 w-full rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-elevated)] px-4 py-3 text-2xl font-semibold text-[var(--terminal-white)] outline-none focus:border-[var(--alfred-amber)]"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--terminal-gray)]">
          <span>About</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-elevated)] px-2 py-1 text-[var(--terminal-white)]"
          >
            {COFFEE.displayCurrencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="font-mono text-[var(--alfred-amber)]">
            {localHint || "…"}
          </span>
          {rates?.date && rates.date !== "fallback" ? (
            <span className="text-xs text-[var(--terminal-muted)]">rate {rates.date}</span>
          ) : null}
        </div>

        <input
          className="mt-5 w-full rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-elevated)] px-4 py-2.5 text-sm text-[var(--terminal-white)] outline-none focus:border-[var(--alfred-amber)]"
          placeholder="Name on the board (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          type="button"
          disabled={busy || amount < COFFEE.tipMinUsd}
          onClick={sendCoffee}
          className="mt-6 w-full rounded-lg bg-[var(--alfred-amber)] py-3 text-sm font-semibold text-[var(--terminal-black)] disabled:opacity-50"
        >
          {busy ? "…" : `Buy me a coffee · $${amount}`}
        </button>
        <p className="mt-3 text-center text-xs text-[var(--terminal-muted)]">
          From ${COFFEE.tipMinUsd}. Everything in Alfred Terminal stays free.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--terminal-gray)]">Kind souls</h2>
        <ol className="mt-4 space-y-3">
          {leaderboard.length === 0 ? (
            <li className="text-sm text-[var(--terminal-muted)]">No coffees yet.</li>
          ) : (
            leaderboard.map((e, i) => (
              <li
                key={`${e.displayName}-${e.createdAt}`}
                className="flex items-baseline justify-between border-b border-[var(--terminal-border)] pb-2 text-sm"
              >
                <span className="text-[var(--terminal-white)]">
                  <span className="mr-2 font-mono text-[var(--terminal-muted)]">{i + 1}</span>
                  {e.displayName}
                </span>
                <span className="font-mono text-[var(--alfred-amber)]">${e.amountUsd}</span>
              </li>
            ))
          )}
        </ol>
      </div>

      {message ? (
        <p className="text-center text-sm text-[var(--terminal-gray)]">{message}</p>
      ) : null}
    </div>
  );
}

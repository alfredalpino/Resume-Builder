"use client";

import { useEffect, useMemo, useState } from "react";
import { COFFEE } from "@/lib/billing/entitlements";
import { EpictetusQuote } from "@/components/epictetus-quote";

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

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
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
    const id = setInterval(() => void refresh(), 20000);
    return () => clearInterval(id);
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
      const data = (await res.json()) as {
        ok?: boolean;
        mode?: string;
        message?: string;
        error?: string;
        orderId?: string;
        razorpayKeyId?: string;
        amountUsd?: number;
      };
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      if (data.mode === "live" && data.orderId && data.razorpayKeyId) {
        const loaded = await loadRazorpayScript();
        if (!loaded || !window.Razorpay) {
          throw new Error("Couldn’t open checkout. Refresh and try again.");
        }
        const rzp = new window.Razorpay({
          key: data.razorpayKeyId,
          amount: Math.round((data.amountUsd || amount) * 100),
          currency: "USD",
          name: "Alfred Terminal",
          description: "Buy me a coffee",
          order_id: data.orderId,
          prefill: { name: name || undefined },
          notes: {
            displayName: name || "Anonymous",
            amountUsd: String(data.amountUsd || amount),
          },
          theme: { color: "#F5A524" },
          handler: () => {
            setMessage(
              "Payment received — thank you. You’ll show on Kind souls once it’s confirmed.",
            );
            void refresh();
            window.setTimeout(() => void refresh(), 4000);
          },
        });
        rzp.open();
        setMessage(null);
      } else {
        setMessage(
          data.message ||
            "Checkout isn’t live yet. Nothing was charged, and your name wasn’t listed.",
        );
      }
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 space-y-10">
      <EpictetusQuote />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              className={`min-h-10 rounded-full px-4 py-1.5 text-sm ${
                amount === p
                  ? "bg-[var(--alfred-amber)] text-[var(--bg)]"
                  : "border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--alfred-amber)]/40"
              }`}
            >
              ${p}
            </button>
          ))}
        </div>

        <label className="mt-6 block text-xs uppercase tracking-wide text-[var(--text-muted)]">
          Amount (USD)
          <input
            type="number"
            min={COFFEE.tipMinUsd}
            step={1}
            value={amount}
            onChange={(e) =>
              setAmount(Math.max(COFFEE.tipMinUsd, Number(e.target.value) || COFFEE.tipMinUsd))
            }
            className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 text-2xl font-semibold text-[var(--text)] outline-none focus:border-[var(--alfred-amber)]"
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
          <span>About</span>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--elevated)] px-2 py-1 text-[var(--text)]"
          >
            {COFFEE.displayCurrencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="font-mono text-[var(--alfred-amber)]">{localHint || "…"}</span>
          {rates?.date && rates.date !== "fallback" ? (
            <span className="text-xs text-[var(--text-muted)]">rate {rates.date}</span>
          ) : null}
        </div>

        <input
          className="mt-5 w-full rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--alfred-amber)]"
          placeholder="Name on the board (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          type="button"
          disabled={busy || amount < COFFEE.tipMinUsd}
          onClick={sendCoffee}
          className="mt-6 h-12 w-full rounded-lg bg-[var(--alfred-amber)] text-sm font-semibold text-[var(--bg)] disabled:opacity-50"
        >
          {busy ? "…" : `Buy me a coffee · $${amount}`}
        </button>
        <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
          From ${COFFEE.tipMinUsd}. Everything in Alfred Terminal stays free.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-[var(--text-secondary)]">Kind souls</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Public board of confirmed coffees.
        </p>
        <ol className="mt-4 space-y-3">
          {leaderboard.length === 0 ? (
            <li className="text-sm text-[var(--text-muted)]">No confirmed coffees yet.</li>
          ) : (
            leaderboard.map((e, i) => (
              <li
                key={`${e.displayName}-${e.createdAt}-${e.amountUsd}`}
                className="flex items-baseline justify-between border-b border-[var(--border)] pb-2 text-sm"
              >
                <span className="text-[var(--text)]">
                  <span className="mr-2 font-mono text-[var(--text-muted)]">{i + 1}</span>
                  {e.displayName}
                </span>
                <span className="font-mono text-[var(--alfred-amber)]">${e.amountUsd}</span>
              </li>
            ))
          )}
        </ol>
      </div>

      {message ? (
        <p className="text-center text-sm text-[var(--text-secondary)]">{message}</p>
      ) : null}
    </div>
  );
}

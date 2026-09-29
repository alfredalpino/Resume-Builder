"use client";

import { useCallback, useEffect, useState } from "react";
import { COFFEE } from "@/lib/billing/entitlements";
import { EpictetusQuote } from "@/components/epictetus-quote";

type LeaderEntry = {
  displayName: string;
  amountInr?: number;
  amountUsd?: number;
  createdAt: string;
};

declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => {
      checkout: (opts: {
        paymentSessionId: string;
        redirectTarget?: "_self" | "_blank" | "_top" | "_modal";
      }) => Promise<{
        error?: unknown;
        redirect?: boolean;
        paymentDetails?: { paymentMessage?: string };
      }>;
    };
  }
}

function loadCashfreeScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Cashfree) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CoffeeClient() {
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number>(COFFEE.presetsInr[1]);
  const [custom, setCustom] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cashfreeReady, setCashfreeReady] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/billing");
      if (!res.ok) return;
      const data = (await res.json()) as {
        leaderboard: LeaderEntry[];
        cashfreeReady?: boolean;
      };
      setLeaderboard(data.leaderboard || []);
      setCashfreeReady(Boolean(data.cashfreeReady));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 20000);
    return () => clearInterval(id);
  }, [refresh]);

  // Return URL confirmation: /coffee?order_id=...
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    if (!orderId) return;

    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const res = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = (await res.json()) as {
          paid?: boolean;
          recorded?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (data.paid) {
          setMessage("Thank you for supporting Alfred Terminal.");
          void refresh();
        } else {
          setMessage(
            "Payment wasn't completed. Your account has not been charged by Alfred Terminal.",
          );
        }
        window.history.replaceState({}, "", "/coffee");
      } catch {
        if (!cancelled) {
          setMessage(
            "Payment wasn't completed. Your account has not been charged by Alfred Terminal.",
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function continueToPayment() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name || "Anonymous",
          amountInr: amount,
          optInLeaderboard: true,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        mode?: string;
        message?: string;
        error?: string;
        paymentSessionId?: string;
        cashfreeEnv?: "sandbox" | "production";
        orderId?: string;
      };
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      if (data.mode === "live" && data.paymentSessionId) {
        const loaded = await loadCashfreeScript();
        if (!loaded || !window.Cashfree) {
          throw new Error("Couldn’t open checkout. Refresh and try again.");
        }
        const cashfree = window.Cashfree({
          mode: data.cashfreeEnv || "sandbox",
        });
        setModalOpen(false);
        const result = await cashfree.checkout({
          paymentSessionId: data.paymentSessionId,
          redirectTarget: "_modal",
        });

        if (result.error) {
          setMessage(
            "Payment wasn't completed. Your account has not been charged by Alfred Terminal.",
          );
        } else if (result.paymentDetails) {
          setMessage(
            "Thank you for supporting Alfred Terminal. You’ll show on Kind souls once it’s confirmed.",
          );
          if (data.orderId) {
            await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: data.orderId }),
            }).catch(() => null);
          }
          void refresh();
          window.setTimeout(() => void refresh(), 4000);
        }
      } else {
        setMessage(
          data.message ||
            "Checkout isn’t live yet. Add Cashfree keys on the server — nothing was charged.",
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
        <h2 className="text-lg font-semibold tracking-tight">Support Alfred Terminal</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Help keep Alfred Terminal independent and improving.
        </p>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-6 h-12 w-full rounded-lg bg-[var(--alfred-amber)] text-sm font-semibold text-[var(--bg)]"
        >
          Buy me a coffee
        </button>
        <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
          From ₹{COFFEE.tipMinInr}. Everything in Alfred Terminal stays free.
          {cashfreeReady ? null : " · Checkout keys not configured yet"}
        </p>
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coffee-modal-title"
          onClick={() => !busy && setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="coffee-modal-title" className="text-lg font-semibold">
                  Support Alfred Terminal
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Help keep Alfred Terminal independent and improving.
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
                onClick={() => setModalOpen(false)}
                disabled={busy}
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {COFFEE.presetsInr.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setAmount(p);
                    setCustom(false);
                  }}
                  className={`min-h-10 rounded-full px-4 py-1.5 text-sm ${
                    !custom && amount === p
                      ? "bg-[var(--alfred-amber)] text-[var(--bg)]"
                      : "border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--alfred-amber)]/40"
                  }`}
                >
                  ₹{p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustom(true)}
                className={`min-h-10 rounded-full px-4 py-1.5 text-sm ${
                  custom
                    ? "bg-[var(--alfred-amber)] text-[var(--bg)]"
                    : "border border-[var(--border)] text-[var(--text-secondary)]"
                }`}
              >
                Custom
              </button>
            </div>

            {custom ? (
              <label className="mt-4 block text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Amount (INR)
                <input
                  type="number"
                  min={COFFEE.tipMinInr}
                  max={COFFEE.tipMaxInr}
                  step={1}
                  value={amount}
                  onChange={(e) =>
                    setAmount(
                      Math.min(
                        COFFEE.tipMaxInr,
                        Math.max(
                          COFFEE.tipMinInr,
                          Number(e.target.value) || COFFEE.tipMinInr,
                        ),
                      ),
                    )
                  }
                  className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 text-2xl font-semibold outline-none focus:border-[var(--alfred-amber)]"
                />
              </label>
            ) : null}

            <input
              className="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-4 py-2.5 text-sm outline-none focus:border-[var(--alfred-amber)]"
              placeholder="Name on the board (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <button
              type="button"
              disabled={busy || amount < COFFEE.tipMinInr}
              onClick={() => void continueToPayment()}
              className="mt-5 h-12 w-full rounded-lg bg-[var(--alfred-amber)] text-sm font-semibold text-[var(--bg)] disabled:opacity-50"
            >
              {busy ? "…" : `Continue to Payment · ₹${amount}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">
              UPI, cards, and other methods via Cashfree. International methods depend on your
              merchant account.
            </p>
          </div>
        </div>
      ) : null}

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
                key={`${e.displayName}-${e.createdAt}-${e.amountInr ?? e.amountUsd}`}
                className="flex items-baseline justify-between border-b border-[var(--border)] pb-2 text-sm"
              >
                <span className="text-[var(--text)]">
                  <span className="mr-2 font-mono text-[var(--text-muted)]">{i + 1}</span>
                  {e.displayName}
                </span>
                <span className="font-mono text-[var(--alfred-amber)]">
                  {e.amountInr != null ? `₹${e.amountInr}` : `$${e.amountUsd}`}
                </span>
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

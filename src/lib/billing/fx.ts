import { COFFEE } from "@/lib/billing/entitlements";

export type FxRates = {
  base: "USD";
  date: string;
  rates: Record<string, number>;
};

const FALLBACK: FxRates = {
  base: "USD",
  date: "fallback",
  rates: {
    INR: 83.5,
    EUR: 0.92,
    GBP: 0.79,
    AED: 3.67,
    CAD: 1.36,
    AUD: 1.53,
    SGD: 1.34,
    JPY: 150,
  },
};

/** Live USD rates via Frankfurter (no API key). Cached briefly in memory. */
let cache: { at: number; data: FxRates } | null = null;

export async function fetchUsdRates(): Promise<FxRates> {
  const now = Date.now();
  if (cache && now - cache.at < 60 * 60 * 1000) return cache.data;

  const symbols = COFFEE.displayCurrencies.join(",");
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=USD&to=${symbols}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`);
    const data = (await res.json()) as {
      date?: string;
      rates?: Record<string, number>;
    };
    const out: FxRates = {
      base: "USD",
      date: data.date || new Date().toISOString().slice(0, 10),
      rates: data.rates || FALLBACK.rates,
    };
    cache = { at: now, data: out };
    return out;
  } catch {
    return FALLBACK;
  }
}

export function formatLocal(amountUsd: number, currency: string, rate: number): string {
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

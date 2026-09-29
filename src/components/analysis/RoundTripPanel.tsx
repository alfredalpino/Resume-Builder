"use client";

import type { RoundTripReport } from "@/lib/resume/roundtrip";

export function RoundTripPanel({
  report,
  busy,
  onRun,
}: {
  report: RoundTripReport | null;
  busy: boolean;
  onRun: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Export round-trip</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            PDF → re-parse → check fields still machine-readable
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onRun}
          className="h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-medium disabled:opacity-50"
        >
          {busy ? "Checking…" : "Run check"}
        </button>
      </div>

      {report ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-2xl font-semibold tabular-nums">
              {report.score}
              <span className="text-sm font-medium text-[var(--text-muted)]"> / 100</span>
            </p>
            <span
              className={`text-xs font-medium ${
                report.ok ? "text-[var(--success)]" : "text-[var(--warning)]"
              }`}
            >
              {report.ok ? "Parseable" : "Needs attention"}
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {report.checks.map((c) => (
              <li
                key={c.key}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <span className="text-[var(--text-secondary)]">
                  <span className={c.ok ? "text-[var(--success)]" : "text-[var(--warning)]"}>
                    {c.ok ? "✓" : "!"}
                  </span>{" "}
                  {c.label}
                  {c.detail ? (
                    <span className="mt-0.5 block text-[var(--text-muted)]">{c.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[10px] text-[var(--text-muted)]">
            Extracted {report.textLength} chars · IR {report.irTextLength} chars
          </p>
        </div>
      ) : null}
    </div>
  );
}

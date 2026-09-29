"use client";

import type { AtsRobustnessReport } from "@/lib/ats-robustness";

export function AtsRobustnessPanel({ report }: { report: AtsRobustnessReport }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            ATS score
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
            {report.overall}
            <span className="text-base font-medium text-[var(--text-muted)]"> / 100</span>
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{report.label}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            report.status === "excellent" || report.status === "strong"
              ? "bg-[var(--success)]/15 text-[var(--success)]"
              : report.status === "fair"
                ? "bg-[var(--warning)]/15 text-[var(--warning)]"
                : "bg-[var(--error)]/15 text-[var(--error)]"
          }`}
        >
          {report.status === "excellent"
            ? "Excellent"
            : report.status === "strong"
              ? "Strong"
              : report.status === "fair"
                ? "Fair"
                : "Needs work"}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--elevated)]">
        <div
          className="h-full rounded-full bg-[var(--alfred-amber)] transition-all duration-300"
          style={{ width: `${report.overall}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2.5">
        {report.components.map((c) => (
          <li key={c.key}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-[var(--text-secondary)]">
                {c.label}
                <span className="ml-1 text-[10px] text-[var(--text-muted)]">
                  {c.weight}%
                </span>
              </span>
              <span className="font-medium tabular-nums text-[var(--text)]">{c.score}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--elevated)]">
              <div
                className="h-full rounded-full bg-[var(--alfred-amber)]/70"
                style={{ width: `${c.score}%` }}
              />
            </div>
            {c.notes[0] ? (
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{c.notes[0]}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--text-muted)]">
        {report.disclaimer}
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { AtsRobustnessReport } from "@/lib/ats-robustness";

export function AtsRobustnessPanel({ report }: { report: AtsRobustnessReport }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

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

      <p className="mt-3 text-[11px] text-[var(--text-muted)]">
        Click a factor for details and how to improve it.
      </p>

      <ul className="mt-3 space-y-1.5">
        {report.components.map((c) => {
          const open = openKey === c.key;
          const weak = c.score < 78;
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => setOpenKey(open ? null : c.key)}
                className={`w-full rounded-lg px-2.5 py-2 text-left transition ${
                  open
                    ? "bg-[var(--elevated)]"
                    : "hover:bg-[var(--elevated)]/60"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-[var(--text-secondary)]">
                    {c.label}
                    <span className="ml-1 text-[10px] text-[var(--text-muted)]">
                      {c.weight}%
                    </span>
                  </span>
                  <span
                    className={`font-medium tabular-nums ${
                      weak ? "text-[var(--warning)]" : "text-[var(--text)]"
                    }`}
                  >
                    {c.score}
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className={`h-full rounded-full ${
                      weak ? "bg-[var(--warning)]/80" : "bg-[var(--alfred-amber)]/70"
                    }`}
                    style={{ width: `${c.score}%` }}
                  />
                </div>
              </button>
              {open ? (
                <div className="mt-1 space-y-1.5 border-l-2 border-[var(--alfred-amber)]/40 px-3 py-2">
                  {c.notes.length ? (
                    c.notes.map((n) => (
                      <p key={n} className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        {n}
                      </p>
                    ))
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Looking solid on this factor.
                    </p>
                  )}
                  {weak ? (
                    <p className="text-[11px] font-medium text-[var(--alfred-amber)]">
                      {fixHint(c.key)}
                    </p>
                  ) : null}
                </div>
              ) : c.notes[0] && !open ? (
                <p className="mt-0.5 px-2.5 text-[11px] text-[var(--text-muted)] line-clamp-1">
                  {c.notes[0]}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-[11px] leading-relaxed text-[var(--text-muted)]">
        {report.disclaimer}
      </p>
    </div>
  );
}

function fixHint(key: string): string {
  switch (key) {
    case "parseability":
      return "Fix: put full name, email, phone, and https:// links in the body text.";
    case "structure":
      return "Fix: add summary, dated experience, skills, and education sections.";
    case "requirement_coverage":
      return "Fix: tailor again or weave missing JD tools into skills and bullets.";
    case "evidence_integrity":
      return "Fix: keep real employers/education from your source; avoid dropping identity fields.";
    case "terminology":
      return "Fix: echo skill keywords inside experience bullets and align the headline.";
    case "export_integrity":
      return "Fix: use absolute https:// URLs and export PDF/DOCX from Alfred.";
    default:
      return "Fix: strengthen this section, then re-check the score.";
  }
}

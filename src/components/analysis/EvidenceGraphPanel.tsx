"use client";

import type { ClaimIntegrityReport } from "@/lib/evidence/graph";
import type { EvidenceItem } from "@/lib/evidence/graph";

const STATUS_LABEL: Record<string, string> = {
  SUPPORTED: "Supported",
  PARTIALLY_SUPPORTED: "Partial",
  UNSUPPORTED: "Unsupported",
  NEW_CLAIM: "New claim",
};

export function EvidenceGraphPanel({
  evidence,
  report,
  integrityMode,
  onToggleIntegrity,
  onEnforce,
  busy,
}: {
  evidence: EvidenceItem[];
  report: ClaimIntegrityReport | null;
  integrityMode: boolean;
  onToggleIntegrity: (on: boolean) => void;
  onEnforce?: () => void;
  busy?: boolean;
}) {
  const risky =
    report?.rows.filter(
      (r) => r.status === "UNSUPPORTED" || r.status === "NEW_CLAIM",
    ) || [];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Evidence graph
          </p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {evidence.length} claims indexed from your source resume
          </p>
        </div>
        {report ? (
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">
              {report.integrityScore}
              <span className="text-sm font-medium text-[var(--text-muted)]"> / 100</span>
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">Claim integrity</p>
          </div>
        ) : null}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={integrityMode}
          onChange={(e) => onToggleIntegrity(e.target.checked)}
        />
        Integrity mode (prefer evidenced claims)
      </label>

      {report ? (
        <>
          <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
            {report.summary}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
            <span>✓ {report.supported} supported</span>
            <span>◐ {report.partial} partial</span>
            <span>! {report.unsupported} unsupported</span>
            <span>+ {report.newClaims} new</span>
          </div>

          {risky.length ? (
            <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto">
              {risky.slice(0, 12).map((r) => (
                <li key={`${r.section}-${r.claim.slice(0, 40)}`} className="text-xs">
                  <span className="font-medium text-[var(--warning)]">
                    {STATUS_LABEL[r.status]}
                  </span>
                  <span className="text-[var(--text-muted)]"> · {r.section}</span>
                  <p className="text-[var(--text-secondary)] line-clamp-2">{r.claim}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--success)]">
              No unsupported claims flagged.
            </p>
          )}

          {integrityMode && onEnforce && risky.length ? (
            <button
              type="button"
              disabled={busy}
              onClick={onEnforce}
              className="mt-3 h-9 rounded-lg border border-[var(--border)] px-3 text-xs font-medium disabled:opacity-50"
            >
              {busy ? "Filtering…" : "Strip unsupported claims"}
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Tailor a resume to compare claims against this evidence graph.
        </p>
      )}
    </div>
  );
}

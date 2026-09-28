"use client";

import type { AtsScore } from "@/lib/schema";
import { TAILOR_INTENSITY_META, type TailorIntensity } from "@/lib/center";

export type AnalysisPayload = {
  strongMatches: string[];
  needsAttention: string[];
  opportunities: string[];
  targetRole?: string;
  distance?: "same" | "adjacent" | "hard";
  evidencedTools?: string[];
  missingTools?: string[];
  sectionsToModify?: string[];
  sectionsToPreserve?: string[];
  requirementStatuses?: {
    requirement: string;
    status: "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_SUPPORTED" | "UNCLEAR";
  }[];
};

function distanceLabel(d?: AnalysisPayload["distance"]) {
  if (d === "hard") return "Career pivot";
  if (d === "adjacent") return "Adjacent field";
  if (d === "same") return "Same field";
  return null;
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
        <span className="text-xs tabular-nums text-[var(--text-secondary)]">{Math.round(value)}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--elevated)]">
        <div
          className="h-full rounded-full bg-[var(--alfred-amber)]/80"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

export function AnalysisPanel({
  score,
  analysis,
  recommended,
  onContinue,
  showContinue,
}: {
  score: AtsScore | null;
  analysis: AnalysisPayload | null;
  recommended: TailorIntensity;
  onContinue: () => void;
  showContinue: boolean;
}) {
  const supported =
    analysis?.requirementStatuses?.filter((r) => r.status === "SUPPORTED") ||
    (analysis?.strongMatches || []).map((requirement) => ({
      requirement,
      status: "SUPPORTED" as const,
    }));
  const partial =
    analysis?.requirementStatuses?.filter((r) => r.status === "PARTIALLY_SUPPORTED") || [];
  const gaps =
    analysis?.requirementStatuses?.filter(
      (r) => r.status === "NOT_SUPPORTED" || r.status === "UNCLEAR",
    ) ||
    (analysis?.needsAttention || [])
      .filter((n) => !/\(limited evidence\)/i.test(n))
      .map((requirement) => ({
        requirement: requirement.replace(/ not found on resume$/i, ""),
        status: "NOT_SUPPORTED" as const,
      }));

  const skillPct =
    score && score.hits.length + score.missing.length > 0
      ? (score.hits.length / (score.hits.length + score.missing.length)) * 100
      : score?.keywordScore ?? 0;

  const dist = distanceLabel(analysis?.distance);
  const role = analysis?.targetRole || "Target role";
  const willChange = (analysis?.opportunities || []).slice(0, 3);
  const sections = analysis?.sectionsToModify?.slice(0, 4) || [];

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Application analysis</h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        We compared your experience with the role requirements.
      </p>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        {role}
        {dist ? ` · ${dist}` : ""}
        {score && score.formatScore >= 90 ? " · Format ready" : ""}
      </p>

      <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Role alignment</p>
            <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">
              {score?.matchRate ?? "—"}
              <span className="text-lg font-medium text-[var(--text-muted)]">%</span>
            </p>
          </div>
          <p className="pb-1 text-xs text-[var(--text-secondary)]">
            {(supported.length || 0) + (partial.length || 0)} /{" "}
            {supported.length + partial.length + gaps.length > 0
              ? supported.length + partial.length + gaps.length
              : "—"}{" "}
            requirements covered
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--elevated)]">
          <div
            className="h-full rounded-full bg-[var(--alfred-amber)] transition-all duration-200"
            style={{ width: `${score?.matchRate ?? 0}%` }}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Meter label="Skills" value={skillPct} />
          <Meter label="Keywords" value={score?.keywordScore ?? 0} />
          <Meter label="Format" value={score?.formatScore ?? 0} />
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Requirement coverage
          </p>
          {!supported.length && !partial.length && !gaps.length ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              No exact keyword matches yet. Tailoring will push hard for this role.
            </p>
          ) : (
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto text-sm">
              {supported.map((r) => (
                <li key={`s-${r.requirement}`} className="text-[var(--success)]">
                  ✓ {r.requirement}
                </li>
              ))}
              {partial.map((r) => (
                <li key={`p-${r.requirement}`} className="text-[var(--warning)]">
                  ◐ {r.requirement} — limited evidence
                </li>
              ))}
              {gaps.map((r) => (
                <li key={`g-${r.requirement}`} className="text-[var(--text-secondary)]">
                  ○ {r.requirement} — gap
                </li>
              ))}
            </ul>
          )}
        </div>

        {(analysis?.evidencedTools?.length || analysis?.missingTools?.length) ? (
          <div className="space-y-3">
            {analysis?.evidencedTools?.length ? (
              <div>
                <p className="text-xs text-[var(--text-muted)]">On your resume</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {analysis.evidencedTools.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-[var(--border)] bg-[var(--elevated)] px-2 py-0.5 text-xs text-[var(--text-secondary)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {analysis?.missingTools?.length ? (
              <div>
                <p className="text-xs text-[var(--text-muted)]">JD gaps (tailoring can fill)</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {analysis.missingTools.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--text-muted)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {(willChange.length > 0 || sections.length > 0) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              What Alfred will change
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
              {willChange.map((o) => (
                <li key={o}>· {o}</li>
              ))}
              {sections.length ? (
                <li>· Touch: {sections.join(", ")}</li>
              ) : null}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-[var(--text-muted)]">
        Internal role-alignment metric — not a universal ATS score.
      </p>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Recommended:{" "}
        <span className="font-medium text-[var(--text)]">
          {TAILOR_INTENSITY_META[recommended].label}
        </span>
      </p>

      {showContinue ? (
        <button
          type="button"
          onClick={onContinue}
          className="mt-5 h-12 w-full rounded-lg bg-[var(--alfred-amber)] px-6 text-sm font-semibold text-[var(--bg)] transition-opacity hover:opacity-90 sm:h-11 sm:w-auto"
        >
          Continue to tailor
        </button>
      ) : null}
    </section>
  );
}

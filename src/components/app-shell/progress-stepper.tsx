"use client";

export type WorkflowStepId = 1 | 2 | 3 | 4 | 5;

export const WORKFLOW_STEPS: { id: WorkflowStepId; label: string; short: string }[] = [
  { id: 1, label: "Resume", short: "Resume" },
  { id: 2, label: "Job", short: "Job" },
  { id: 3, label: "Analyze", short: "Analyze" },
  { id: 4, label: "Tailor", short: "Tailor" },
  { id: 5, label: "Review", short: "Review" },
];

type Props = {
  current: WorkflowStepId;
  /** Highest step the user has unlocked (inclusive). */
  unlockedThrough: WorkflowStepId;
  onNavigate: (step: WorkflowStepId) => void;
};

/**
 * Gated progress: completed / current / future.
 * Mobile: equal-width columns with number + short label, large tap targets.
 */
export function ProgressStepper({ current, unlockedThrough, onNavigate }: Props) {
  return (
    <nav
      aria-label="Application progress"
      className="flex w-full min-w-0 items-stretch justify-between gap-0.5 sm:justify-center sm:gap-0 sm:px-2"
    >
      {WORKFLOW_STEPS.map((step, index) => {
        const completed = step.id < current && step.id <= unlockedThrough;
        const active = step.id === current;
        const locked = step.id > unlockedThrough;
        const clickable = !locked;

        return (
          <div key={step.id} className="flex min-w-0 flex-1 items-center sm:flex-none">
            {index > 0 ? (
              <div
                aria-hidden
                className={`mx-0.5 hidden h-px w-4 shrink-0 sm:mx-1.5 sm:block sm:w-6 md:mx-2 md:w-8 ${
                  step.id <= unlockedThrough
                    ? "bg-[var(--alfred-amber)]/50"
                    : "bg-[var(--border)]"
                }`}
              />
            ) : null}
            <button
              type="button"
              disabled={locked}
              aria-current={active ? "step" : undefined}
              aria-label={`${step.label}${locked ? " (locked)" : active ? " (current)" : ""}`}
              onClick={() => clickable && onNavigate(step.id)}
              className={`flex min-h-11 w-full flex-col items-center justify-center rounded-lg px-0.5 py-1.5 text-center transition active:scale-[0.98] sm:min-h-0 sm:w-auto sm:flex-row sm:items-baseline sm:rounded-md sm:px-2 sm:py-1 sm:text-left ${
                active
                  ? "bg-[var(--alfred-amber)]/10 font-semibold text-[var(--alfred-amber)] sm:bg-transparent"
                  : completed
                    ? "text-[var(--text-secondary)]"
                    : locked
                      ? "cursor-not-allowed text-[var(--text-muted)] opacity-45"
                      : "text-[var(--text-muted)]"
              }`}
            >
              <span className="font-mono text-[10px] tabular-nums sm:text-[11px] md:text-xs">
                {String(step.id).padStart(2, "0")}
              </span>
              <span className="mt-0.5 max-w-full truncate text-[10px] leading-tight sm:ml-1 sm:mt-0 sm:text-xs">
                {step.short}
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

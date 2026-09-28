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
 * Future steps are not clickable until unlocked by real workflow progress.
 */
export function ProgressStepper({ current, unlockedThrough, onNavigate }: Props) {
  return (
    <nav aria-label="Application progress" className="flex min-w-0 flex-1 items-center justify-center gap-0 px-2">
      {WORKFLOW_STEPS.map((step, index) => {
        const completed = step.id < current && step.id <= unlockedThrough;
        const active = step.id === current;
        const locked = step.id > unlockedThrough;
        const clickable = !locked;

        return (
          <div key={step.id} className="flex min-w-0 items-center">
            {index > 0 ? (
              <div
                aria-hidden
                className={`mx-1 hidden h-px w-6 sm:mx-2 sm:block sm:w-8 md:w-10 ${
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
              onClick={() => clickable && onNavigate(step.id)}
              className={`shrink-0 rounded-md px-1.5 py-1 text-left text-[11px] transition sm:px-2 sm:text-xs ${
                active
                  ? "font-semibold text-[var(--alfred-amber)]"
                  : completed
                    ? "text-[var(--text-secondary)] hover:text-[var(--text)]"
                    : locked
                      ? "cursor-not-allowed text-[var(--text-muted)] opacity-50"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              <span className="font-mono tabular-nums">
                {String(step.id).padStart(2, "0")}
              </span>
              <span className="ml-1 hidden sm:inline">{step.short}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

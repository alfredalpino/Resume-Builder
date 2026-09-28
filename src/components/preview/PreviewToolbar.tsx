"use client";

export type PreviewZoom = "fit" | 0.75 | 1 | 1.25;

type ViewMode = "original" | "tailored" | "compare" | "edit";

const VIEW_LABELS: Record<ViewMode, string> = {
  original: "Original",
  tailored: "Tailored",
  compare: "Compare",
  edit: "Edit",
};

export function PreviewToolbar({
  viewMode,
  onViewMode,
  zoom,
  onZoom,
  compact,
  hideZoom,
}: {
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  zoom: PreviewZoom;
  onZoom: (z: PreviewZoom) => void;
  /** Tighter toolbar for phones */
  compact?: boolean;
  /** Hide zoom when using fluid mobile paper */
  hideZoom?: boolean;
}) {
  return (
    <div
      className={`sticky top-0 z-10 space-y-2 border-b border-[var(--border)] bg-[var(--elevated)]/95 backdrop-blur ${
        compact ? "px-2 py-2" : "px-3 py-2.5 sm:px-4 sm:py-3"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Resume preview
        </h2>
        {compact ? (
          <p className="text-[10px] text-[var(--text-muted)]">Scroll to read</p>
        ) : (
          <p className="hidden text-[10px] text-[var(--text-muted)] sm:block lg:hidden">
            A4 · pinch scroll
          </p>
        )}
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
          {(["original", "tailored", "compare", "edit"] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onViewMode(m)}
              className={`min-h-9 rounded-md px-2.5 text-xs transition-colors duration-150 ${
                viewMode === m
                  ? "bg-[var(--elevated)] font-medium text-[var(--text)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {VIEW_LABELS[m]}
            </button>
          ))}
        </div>
        {!hideZoom && viewMode !== "edit" ? (
          <div className="flex shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
            {(
              [
                ["fit", "Fit"],
                [0.75, "75%"],
                [1, "100%"],
                [1.25, "125%"],
              ] as const
            ).map(([z, label]) => (
              <button
                key={String(z)}
                type="button"
                onClick={() => onZoom(z)}
                className={`min-h-9 rounded-md px-2.5 text-xs transition-colors duration-150 ${
                  zoom === z
                    ? "bg-[var(--elevated)] font-medium text-[var(--text)]"
                    : "text-[var(--text-muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

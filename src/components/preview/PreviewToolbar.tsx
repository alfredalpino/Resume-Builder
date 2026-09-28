"use client";

export type PreviewZoom = "fit" | 0.75 | 1 | 1.25;

type ViewMode = "original" | "tailored" | "compare" | "edit";

export function PreviewToolbar({
  viewMode,
  onViewMode,
  zoom,
  onZoom,
}: {
  viewMode: ViewMode;
  onViewMode: (m: ViewMode) => void;
  zoom: PreviewZoom;
  onZoom: (z: PreviewZoom) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Resume preview
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
          {(["original", "tailored", "compare", "edit"] as ViewMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onViewMode(m)}
              className={`rounded-md px-2 py-1 text-[11px] capitalize transition-colors duration-150 ${
                viewMode === m
                  ? "bg-[var(--elevated)] text-[var(--text)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        {viewMode !== "edit" ? (
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
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
                className={`rounded-md px-2 py-1 text-[11px] transition-colors duration-150 ${
                  zoom === z
                    ? "bg-[var(--elevated)] text-[var(--text)]"
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

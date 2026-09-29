"use client";

import type { ApplicationHistoryEntry, MasterProfile } from "@/lib/profile/master-profile";

export function MasterProfileBar({
  profile,
  onSave,
  onLoad,
  onClear,
  onSync,
  busy,
}: {
  profile: MasterProfile | null;
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  onSync?: () => void;
  busy?: boolean;
}) {
  const apps = profile?.applications || [];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Master profile</p>
          <p className="text-xs text-[var(--text-muted)]">
            {profile
              ? `Saved ${new Date(profile.updatedAt).toLocaleString()} · ${profile.evidence.length} evidence · ${apps.length} applications`
              : "Not saved yet — save your source resume as the reusable profile"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onSave}
            className="h-9 rounded-lg bg-[var(--alfred-amber)] px-3 text-xs font-semibold text-[var(--bg)] disabled:opacity-50"
          >
            Save profile
          </button>
          <button
            type="button"
            disabled={busy || !profile}
            onClick={onLoad}
            className="h-9 rounded-lg border border-[var(--border)] px-3 text-xs disabled:opacity-50"
          >
            Load
          </button>
          {onSync ? (
            <button
              type="button"
              disabled={busy || !profile}
              onClick={onSync}
              className="h-9 rounded-lg border border-[var(--border)] px-3 text-xs disabled:opacity-50"
            >
              Sync cloud
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy || !profile}
            onClick={onClear}
            className="h-9 rounded-lg border border-[var(--border)] px-3 text-xs text-[var(--error)] disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {apps.length ? (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Application history
          </p>
          <ul className="mt-2 max-h-36 space-y-2 overflow-y-auto">
            {apps.slice(0, 8).map((a: ApplicationHistoryEntry) => (
              <li key={a.id} className="text-xs text-[var(--text-secondary)]">
                <span className="font-medium text-[var(--text)]">
                  {a.targetRole || "Role"}
                </span>
                {a.companyHint ? ` · ${a.companyHint}` : ""}
                {a.matchRate != null ? (
                  <span className="text-[var(--alfred-amber)]"> · {a.matchRate}%</span>
                ) : null}
                <span className="text-[var(--text-muted)]">
                  {" "}
                  · {new Date(a.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

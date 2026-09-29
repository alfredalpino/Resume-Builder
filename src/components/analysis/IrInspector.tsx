"use client";

import { useEffect, useState } from "react";
import {
  StructuredResumeSchema,
  type StructuredResume,
} from "@/lib/schema";

type Props = {
  resume: StructuredResume;
  onApply: (next: StructuredResume) => void;
};

export function IrInspector({ resume, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(resume, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    setText(JSON.stringify(resume, null, 2));
    setError(null);
    setOkMsg(null);
  }, [resume]);

  function validateAndApply() {
    setError(null);
    setOkMsg(null);
    try {
      const parsed = JSON.parse(text) as unknown;
      const result = StructuredResumeSchema.safeParse(parsed);
      if (!result.success) {
        const msg = result.error.issues
          .slice(0, 4)
          .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
          .join("; ");
        setError(msg || "Invalid resume JSON");
        return;
      }
      onApply(result.data);
      setOkMsg("IR applied — preview updated.");
      setText(JSON.stringify(result.data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
      >
        <span>JSON IR inspector</span>
        <span className="text-xs text-[var(--text-muted)]">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-[var(--border)] px-4 py-3">
          <p className="text-xs text-[var(--text-secondary)]">
            StructuredResume is the intermediate representation. Edit JSON carefully, then Apply —
            Zod validates before preview updates.
          </p>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
              setOkMsg(null);
            }}
            rows={16}
            spellCheck={false}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus:border-[var(--alfred-amber)]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={validateAndApply}
              className="h-10 rounded-lg bg-[var(--alfred-amber)] px-4 text-sm font-semibold text-[var(--bg)]"
            >
              Validate & apply
            </button>
            <button
              type="button"
              onClick={() => {
                setText(JSON.stringify(resume, null, 2));
                setError(null);
                setOkMsg(null);
              }}
              className="h-10 rounded-lg border border-[var(--border)] px-4 text-sm"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(text);
                  setOkMsg("Copied to clipboard.");
                } catch {
                  setError("Couldn’t copy");
                }
              }}
              className="h-10 rounded-lg border border-[var(--border)] px-4 text-sm"
            >
              Copy
            </button>
          </div>
          {error ? (
            <p className="text-xs text-[var(--error)]">{error}</p>
          ) : null}
          {okMsg ? (
            <p className="text-xs text-[var(--success)]">{okMsg}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

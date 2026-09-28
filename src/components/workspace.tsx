"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { AtsScore, StructuredResume } from "@/lib/schema";
import { emptyResume } from "@/lib/schema";
import { SignOutButton } from "@/components/auth-buttons";
import { TAILOR_INTENSITY_META, type TailorIntensity } from "@/lib/center";
import {
  DEFAULT_RESUME_STYLE,
  previewFontFamily,
  type ResumeStyle,
} from "@/lib/style";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
};

type ViewMode = "preview" | "compare" | "edit";

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ResumeCard({
  resume,
  label,
  style,
}: {
  resume: StructuredResume;
  label: string;
  style: ResumeStyle;
}) {
  const css: CSSProperties = {
    fontFamily: previewFontFamily(style),
    fontSize: `${style.fontSize}px`,
    lineHeight: 1.4,
  };
  const showHeadline = style.showHeadline && Boolean(resume.headline?.trim());

  return (
    <article
      style={css}
      className="max-h-[min(78vh,880px)] overflow-auto rounded-md border border-stone-200 bg-white p-6 text-[#111] shadow-inner"
    >
      <p
        className="mb-2 text-center font-semibold uppercase tracking-wider text-teal-800"
        style={{ fontSize: Math.max(8, style.fontSize - 1) }}
      >
        {label}
      </p>
      <h1
        className="text-center font-bold tracking-wide"
        style={{ fontSize: style.fontSize + 7 }}
      >
        {resume.contact.fullName.toUpperCase()}
      </h1>
      {showHeadline ? (
        <p className="mt-1 text-center font-semibold" style={{ fontSize: style.fontSize + 0.5 }}>
          {resume.headline}
        </p>
      ) : null}
      <p className="mt-1 text-center" style={{ fontSize: Math.max(8, style.fontSize - 1) }}>
        {[resume.contact.location, resume.contact.email, resume.contact.phone]
          .filter(Boolean)
          .join("  ·  ")}
      </p>
      {resume.summary ? (
        <>
          <h3 className="mt-3 border-b border-[#111] pb-0.5 font-bold uppercase tracking-wide">
            Professional Summary
          </h3>
          <p className="mt-1 text-justify">{resume.summary}</p>
        </>
      ) : null}
      {resume.skills.length ? (
        <>
          <h3 className="mt-3 border-b border-[#111] pb-0.5 font-bold uppercase tracking-wide">
            Skills
          </h3>
          {resume.skills.map((g) => (
            <p key={g.category} className="mt-1">
              <strong>{g.category}: </strong>
              {g.items.join(" · ")}
            </p>
          ))}
        </>
      ) : null}
      {resume.experience.length ? (
        <>
          <h3 className="mt-3 border-b border-[#111] pb-0.5 font-bold uppercase tracking-wide">
            Experience
          </h3>
          {resume.experience.map((job, idx) => (
            <div key={`${job.company}-${idx}`} className="mt-1.5">
              <p className="font-bold">
                {job.company} — {job.title}
              </p>
              <p style={{ fontSize: Math.max(8, style.fontSize - 1) }} className="text-stone-600">
                {job.start} – {job.end}
                {job.location ? `  ·  ${job.location}` : ""}
              </p>
              <ul className="mt-0.5 pl-2">
                {job.bullets.map((b, i) => (
                  <li key={i}>• {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}
      {resume.projects.length ? (
        <>
          <h3 className="mt-3 border-b border-[#111] pb-0.5 font-bold uppercase tracking-wide">
            Projects
          </h3>
          {resume.projects.map((p, idx) => (
            <div key={`${p.name}-${idx}`} className="mt-1.5">
              <p className="font-bold">{p.name}</p>
              <ul className="pl-2">
                {p.bullets.map((b, i) => (
                  <li key={i}>• {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}
      {resume.education.length ? (
        <>
          <h3 className="mt-3 border-b border-[#111] pb-0.5 font-bold uppercase tracking-wide">
            Education
          </h3>
          {resume.education.map((e, idx) => (
            <p key={`${e.school}-${idx}`} className="mt-1">
              {e.degree} — {e.school}
              {e.dates ? `  ·  ${e.dates}` : ""}
            </p>
          ))}
        </>
      ) : null}
    </article>
  );
}

export function Workspace({ userName, userEmail }: Props) {
  const [rawText, setRawText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [sourceResume, setSourceResume] = useState<StructuredResume>(emptyResume());
  const [resume, setResume] = useState<StructuredResume>(emptyResume());
  const [score, setScore] = useState<AtsScore | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<TailorIntensity>("medium");
  const [appliedIntensity, setAppliedIntensity] = useState<TailorIntensity | null>(null);
  const [style, setStyle] = useState<ResumeStyle>(DEFAULT_RESUME_STYLE);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [coverLetter, setCoverLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const scoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasSource = useMemo(
    () => sourceResume.contact.fullName !== "Your Name" || Boolean(sourceResume.summary),
    [sourceResume],
  );

  const liveScore = useCallback(async (r: StructuredResume, jd: string) => {
    if (!jd.trim() || jd.trim().length < 40) return;
    if (r.contact.fullName === "Your Name" && !r.summary) return;
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume: r, jobDescription: jd }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { score: AtsScore };
      setScore(data.score);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (scoreTimer.current) clearTimeout(scoreTimer.current);
    scoreTimer.current = setTimeout(() => {
      void liveScore(resume, jobDescription);
    }, 600);
    return () => {
      if (scoreTimer.current) clearTimeout(scoreTimer.current);
    };
  }, [resume, jobDescription, liveScore]);

  function adoptParsed(parsed: StructuredResume, text?: string) {
    setSourceResume(structuredClone(parsed));
    setResume(parsed);
    setScore(null);
    setAppliedIntensity(null);
    setCoverLetter("");
    setViewMode("preview");
    if (text !== undefined) setRawText(text);
  }

  async function onFileChange(file: File | null) {
    if (!file) return;
    setBusy("parse");
    setError(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", body: form });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { rawText: string; resume: StructuredResume };
      adoptParsed(data.resume, data.rawText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setBusy(null);
    }
  }

  async function parsePastedText() {
    if (!rawText.trim()) {
      setError("Paste resume text first");
      return;
    }
    setBusy("parse");
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { resume: StructuredResume };
      adoptParsed(data.resume);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setBusy(null);
    }
  }

  function startProgress() {
    setProgress(8);
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setProgress((p) => (p >= 92 ? p : p + Math.random() * 10));
    }, 280);
  }

  function stopProgress() {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 400);
  }

  async function tailor(nextIntensity: TailorIntensity = intensity) {
    if (!jobDescription.trim()) {
      setError("Paste a job description");
      return;
    }
    if (!hasSource) {
      setError("Import or parse a resume first");
      return;
    }
    setBusy("tailor");
    setError(null);
    setIntensity(nextIntensity);
    startProgress();
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: sourceResume,
          jobDescription,
          intensity: nextIntensity,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        resume: StructuredResume;
        score: AtsScore;
        intensity?: TailorIntensity;
      };
      setResume(data.resume);
      setScore(data.score);
      setAppliedIntensity(data.intensity || nextIntensity);
      setViewMode("compare");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tailoring failed");
    } finally {
      stopProgress();
      setBusy(null);
    }
  }

  async function generateCoverLetter() {
    if (!jobDescription.trim() || !hasSource) {
      setError("Need a resume and job description for the cover letter");
      return;
    }
    setBusy("cover");
    setError(null);
    startProgress();
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          jobDescription,
          intensity: appliedIntensity || intensity,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { letter: string };
      setCoverLetter(data.letter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover letter failed");
    } finally {
      stopProgress();
      setBusy(null);
    }
  }

  async function copyCoverLetter() {
    if (!coverLetter) return;
    await navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function exportCover(kind: "pdf" | "docx") {
    if (!coverLetter) {
      setError("Generate a cover letter first");
      return;
    }
    setBusy(`cover-${kind}`);
    setError(null);
    try {
      const res = await fetch("/api/cover-letter/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          letter: coverLetter,
          kind,
          authorName: resume.contact.fullName,
          style,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const blob = await res.blob();
      const base = resume.contact.fullName.replace(/\s+/g, "_") || "Candidate";
      downloadBlob(blob, `${base}_Cover_Letter.${kind}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover letter export failed");
    } finally {
      setBusy(null);
    }
  }

  function resetToOriginal() {
    setResume(structuredClone(sourceResume));
    setAppliedIntensity(null);
    setCoverLetter("");
    setError(null);
    setViewMode("preview");
  }

  async function exportFile(kind: "pdf" | "docx") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/export/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume, style }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const blob = await res.blob();
      const base = resume.contact.fullName.replace(/\s+/g, "_") || "Resume";
      const tag = appliedIntensity ? `_${appliedIntensity}` : "";
      downloadBlob(blob, `${base}_ATS${tag}.${kind}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  function updateContactField(
    field: "fullName" | "email" | "phone" | "location",
    value: string,
  ) {
    setResume((r) => ({ ...r, contact: { ...r.contact, [field]: value } }));
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8f5f2_0%,_#f7f4ef_45%,_#f3efe8_100%)] text-stone-900">
      <header className="border-b border-stone-200/80 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-lg font-semibold tracking-tight">Resume-Builder</p>
            <p className="text-xs text-stone-500">
              {userName || userEmail || "user"} · vibe editor · cover letter · live ATS
            </p>
          </div>
          <SignOutButton />
        </div>
        {busy === "tailor" || busy === "cover" || progress > 0 ? (
          <div className="h-1.5 w-full bg-stone-200">
            <div
              className="h-full bg-teal-600 transition-all duration-300 ease-out"
              style={{ width: `${Math.max(progress, busy ? 8 : 0)}%` }}
            />
          </div>
        ) : (
          <div className="h-1.5 w-full bg-transparent" />
        )}
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              1 · Import resume
            </h2>
            <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center hover:border-teal-600">
              <span className="text-sm font-medium">Drop PDF / DOCX / TXT / MD</span>
              <span className="mt-1 text-xs text-stone-500">
                {fileName || "or click to browse · max 5 MB"}
              </span>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              />
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Or paste resume text…"
              rows={5}
              className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs outline-none focus:border-teal-600"
            />
            <button
              type="button"
              disabled={!!busy}
              onClick={parsePastedText}
              className="mt-2 rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50 disabled:opacity-50"
            >
              {busy === "parse" ? "Parsing…" : "Parse pasted text"}
            </button>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              2 · Job description
            </h2>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description…"
              rows={8}
              className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              3 · Rewrite intensity
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(["subtle", "medium", "hard"] as TailorIntensity[]).map((mode) => {
                const meta = TAILOR_INTENSITY_META[mode];
                const active = intensity === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setIntensity(mode)}
                    className={`rounded-lg border px-3 py-3 text-left ${
                      active
                        ? "border-teal-700 bg-teal-50 ring-1 ring-teal-700"
                        : "border-stone-200 bg-stone-50 hover:border-teal-500"
                    }`}
                  >
                    <p className="text-sm font-semibold">{meta.label}</p>
                    <p className="mt-1 text-xs text-stone-600">{meta.blurb}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => tailor(intensity)}
                className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {busy === "tailor"
                  ? "Working…"
                  : `Apply ${TAILOR_INTENSITY_META[intensity].label}`}
              </button>
              <button
                type="button"
                disabled={!!busy || !hasSource}
                onClick={resetToOriginal}
                className="rounded-md border border-stone-300 px-4 py-2.5 text-sm font-medium disabled:opacity-50"
              >
                Reset to original
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Vibe editor
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Live preview and PDF/DOCX exports use these settings.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={style.showHeadline}
                onChange={(e) =>
                  setStyle((s) => ({ ...s, showHeadline: e.target.checked }))
                }
              />
              Show headline under name
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-stone-500">
                  Font
                </span>
                <select
                  className="w-full rounded-md border border-stone-300 px-3 py-2"
                  value={style.fontFamily}
                  onChange={(e) =>
                    setStyle((s) => ({
                      ...s,
                      fontFamily: e.target.value as ResumeStyle["fontFamily"],
                    }))
                  }
                >
                  <option value="helvetica">Helvetica / Arial (ATS-safe)</option>
                  <option value="times">Times New Roman</option>
                  <option value="courier">Courier</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-stone-500">
                  Body size ({style.fontSize}pt)
                </span>
                <input
                  type="range"
                  min={8}
                  max={12}
                  step={0.5}
                  value={style.fontSize}
                  onChange={(e) =>
                    setStyle((s) => ({ ...s, fontSize: Number(e.target.value) }))
                  }
                  className="mt-2 w-full"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Cover letter
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              Written from your tailored resume + JD. Truthful — no invented stack.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={generateCoverLetter}
                className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy === "cover" ? "Writing…" : "Generate cover letter"}
              </button>
              <button
                type="button"
                disabled={!coverLetter}
                onClick={copyCoverLetter}
                className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                disabled={!coverLetter || !!busy}
                onClick={() => exportCover("pdf")}
                className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                PDF
              </button>
              <button
                type="button"
                disabled={!coverLetter || !!busy}
                onClick={() => exportCover("docx")}
                className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                DOCX
              </button>
            </div>
            {coverLetter ? (
              <textarea
                className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-teal-600"
                rows={14}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
              />
            ) : null}
          </section>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {score ? (
            <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                    ATS score
                    <span className="ml-2 rounded bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-teal-800">
                      live
                    </span>
                  </h2>
                  <p className="mt-1 text-3xl font-semibold tracking-tight">
                    {score.matchRate}%
                    <span className="ml-2 text-sm font-normal text-stone-500">
                      target {score.target}%
                    </span>
                  </p>
                  <p className="text-xs text-stone-500">
                    Skills {score.keywordScore}% · TF-IDF {score.similarity ?? "—"}% · Format{" "}
                    {score.formatScore}%
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => exportFile("pdf")}
                    className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busy === "pdf" ? "Building…" : "Download PDF"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => exportFile("docx")}
                    className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    {busy === "docx" ? "Building…" : "Download DOCX"}
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-teal-800">Skill overlaps</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {score.hits.length ? (
                      score.hits.map((h) => (
                        <span
                          key={h}
                          className="rounded bg-teal-50 px-2 py-0.5 text-xs text-teal-900"
                        >
                          {h}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-stone-500">No stack overlaps yet</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-800">
                    Skill gaps (not on resume)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {score.missing.length ? (
                      score.missing.map((h) => (
                        <span
                          key={h}
                          className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-900"
                        >
                          {h}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-stone-500">No major stack gaps</span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Live view
            </h2>
            <div className="ml-auto flex gap-1 rounded-md border border-stone-200 bg-white p-0.5">
              {(["preview", "compare", "edit"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={`rounded px-2 py-1 text-xs font-medium capitalize ${
                    viewMode === m ? "bg-stone-900 text-white" : "text-stone-600"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {viewMode === "preview" ? (
            <ResumeCard
              resume={resume}
              style={style}
              label={
                appliedIntensity
                  ? `Live preview · ${appliedIntensity}`
                  : "Live preview · source"
              }
            />
          ) : null}

          {viewMode === "compare" ? (
            <div className="grid gap-3">
              <ResumeCard resume={sourceResume} style={style} label="Original" />
              <ResumeCard
                resume={resume}
                style={style}
                label={appliedIntensity ? `Tailored · ${appliedIntensity}` : "Tailored"}
              />
            </div>
          ) : null}

          {viewMode === "edit" ? (
            <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <EditPanel
                resume={resume}
                setResume={setResume}
                updateContactField={updateContactField}
                setError={setError}
              />
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!!busy || !hasSource}
              onClick={() => exportFile("pdf")}
              className="flex-1 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              PDF
            </button>
            <button
              type="button"
              disabled={!!busy || !hasSource}
              onClick={() => exportFile("docx")}
              className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              DOCX
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}

function EditPanel({
  resume,
  setResume,
  updateContactField,
  setError,
}: {
  resume: StructuredResume;
  setResume: Dispatch<SetStateAction<StructuredResume>>;
  updateContactField: (
    field: "fullName" | "email" | "phone" | "location",
    value: string,
  ) => void;
  setError: (v: string | null) => void;
}) {
  return (
    <div className="grid gap-2">
      <input
        className="rounded-md border border-stone-300 px-3 py-2 text-sm"
        value={resume.contact.fullName}
        onChange={(e) => updateContactField("fullName", e.target.value)}
        placeholder="Full name"
      />
      <input
        className="rounded-md border border-stone-300 px-3 py-2 text-sm"
        value={resume.contact.email}
        onChange={(e) => updateContactField("email", e.target.value)}
        placeholder="Email"
      />
      <input
        className="rounded-md border border-stone-300 px-3 py-2 text-sm"
        value={resume.contact.phone}
        onChange={(e) => updateContactField("phone", e.target.value)}
        placeholder="Phone"
      />
      <input
        className="rounded-md border border-stone-300 px-3 py-2 text-sm"
        value={resume.contact.location || ""}
        onChange={(e) => updateContactField("location", e.target.value)}
        placeholder="Location"
      />
      <input
        className="rounded-md border border-stone-300 px-3 py-2 text-sm"
        value={resume.headline}
        onChange={(e) => setResume((r) => ({ ...r, headline: e.target.value }))}
        placeholder="Headline"
      />
      <textarea
        className="rounded-md border border-stone-300 px-3 py-2 text-sm"
        rows={5}
        value={resume.summary}
        onChange={(e) => setResume((r) => ({ ...r, summary: e.target.value }))}
        placeholder="Summary"
      />
      <textarea
        className="rounded-md border border-stone-300 px-3 py-2 font-mono text-xs"
        rows={12}
        value={JSON.stringify(resume, null, 2)}
        onChange={(e) => {
          try {
            setResume(JSON.parse(e.target.value) as StructuredResume);
            setError(null);
          } catch {
            setError("Invalid resume JSON");
          }
        }}
      />
    </div>
  );
}

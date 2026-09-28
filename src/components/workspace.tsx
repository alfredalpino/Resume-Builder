"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { AtsScore, StructuredResume } from "@/lib/schema";
import { emptyResume } from "@/lib/schema";
import { SignOutButton } from "@/components/auth-buttons";
import {
  TAILOR_INTENSITY_META,
  type TailorIntensity,
} from "@/lib/center";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
};

type ViewTab = "preview" | "edit";

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

function ResumePreview({
  resume,
  intensity,
}: {
  resume: StructuredResume;
  intensity?: TailorIntensity | null;
}) {
  return (
    <article className="max-h-[min(80vh,900px)] overflow-auto rounded-md border border-stone-200 bg-white p-8 text-[10.5px] leading-[1.35] text-[#111] shadow-inner">
      {intensity ? (
        <p className="mb-3 text-center text-[9px] font-semibold uppercase tracking-wider text-teal-800">
          Live preview · {TAILOR_INTENSITY_META[intensity].label} mode
        </p>
      ) : (
        <p className="mb-3 text-center text-[9px] font-semibold uppercase tracking-wider text-stone-400">
          Live preview · source resume
        </p>
      )}
      <h1 className="text-center text-[18px] font-bold tracking-wide">
        {resume.contact.fullName.toUpperCase()}
      </h1>
      {resume.headline ? (
        <p className="mt-1 text-center text-[10.5px] font-semibold">{resume.headline}</p>
      ) : null}
      <p className="mt-1 text-center text-[9px]">
        {[resume.contact.location, resume.contact.email, resume.contact.phone]
          .filter(Boolean)
          .join("  ·  ")}
        {resume.contact.links.length
          ? `  ·  ${resume.contact.links.map((l) => l.label).join("  ·  ")}`
          : ""}
      </p>
      {resume.summary ? (
        <>
          <h3 className="mt-4 border-b border-[#111] pb-0.5 text-[10.5px] font-bold uppercase tracking-wide">
            Professional Summary
          </h3>
          <p className="mt-1 text-justify">{resume.summary}</p>
        </>
      ) : null}
      {resume.skills.length ? (
        <>
          <h3 className="mt-4 border-b border-[#111] pb-0.5 text-[10.5px] font-bold uppercase tracking-wide">
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
          <h3 className="mt-4 border-b border-[#111] pb-0.5 text-[10.5px] font-bold uppercase tracking-wide">
            Professional Experience
          </h3>
          {resume.experience.map((job, idx) => (
            <div key={`${job.company}-${idx}`} className="mt-2">
              <p className="font-bold">
                {job.company} — {job.title}
              </p>
              <p className="text-[9px] text-stone-600">
                {job.start} – {job.end}
                {job.location ? `  ·  ${job.location}` : ""}
              </p>
              <ul className="mt-0.5 list-none pl-2">
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
          <h3 className="mt-4 border-b border-[#111] pb-0.5 text-[10.5px] font-bold uppercase tracking-wide">
            Projects
          </h3>
          {resume.projects.map((p, idx) => (
            <div key={`${p.name}-${idx}`} className="mt-2">
              <p className="font-bold">
                {p.name}
                {p.url ? `  ·  ${p.url.replace(/^https?:\/\//, "")}` : ""}
              </p>
              <ul className="mt-0.5 list-none pl-2">
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
          <h3 className="mt-4 border-b border-[#111] pb-0.5 text-[10.5px] font-bold uppercase tracking-wide">
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
  const [thinking, setThinking] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<TailorIntensity>("medium");
  const [appliedIntensity, setAppliedIntensity] = useState<TailorIntensity | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>("preview");
  const [showOriginal, setShowOriginal] = useState(false);

  const hasSource = useMemo(
    () => sourceResume.contact.fullName !== "Your Name" || Boolean(sourceResume.summary),
    [sourceResume],
  );

  function adoptParsed(parsed: StructuredResume, text?: string) {
    setSourceResume(structuredClone(parsed));
    setResume(parsed);
    setScore(null);
    setThinking([]);
    setAppliedIntensity(null);
    setShowOriginal(false);
    setViewTab("preview");
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
    try {
      // Always tailor from the original source so intensity switches are clean
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
      setThinking(data.score.thinking || []);
      setAppliedIntensity(data.intensity || nextIntensity);
      setShowOriginal(false);
      setViewTab("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tailoring failed");
    } finally {
      setBusy(null);
    }
  }

  function resetToOriginal() {
    setResume(structuredClone(sourceResume));
    setScore(null);
    setThinking([]);
    setAppliedIntensity(null);
    setShowOriginal(false);
    setError(null);
  }

  async function exportFile(kind: "pdf" | "docx") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/export/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume }),
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

  const previewResume = showOriginal ? sourceResume : resume;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8f5f2_0%,_#f7f4ef_45%,_#f3efe8_100%)] text-stone-900">
      <header className="border-b border-stone-200/80 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-lg font-semibold tracking-tight">Resume-Builder</p>
            <p className="text-xs text-stone-500">
              {userName || userEmail || "user"} · intensity modes · live preview · no API keys
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
        <div className="flex flex-col gap-5">
          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              1 · Import resume
            </h2>
            <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-center transition hover:border-teal-600 hover:bg-teal-50/40">
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
              placeholder="Or paste resume text here…"
              rows={6}
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
              rows={10}
              className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
          </section>

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              3 · Rewrite intensity
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Pick how far to push the rewrite. Tailoring always starts from your original
              import — switch modes anytime.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(["subtle", "medium", "hard"] as TailorIntensity[]).map((mode) => {
                const meta = TAILOR_INTENSITY_META[mode];
                const active = intensity === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setIntensity(mode)}
                    className={`rounded-lg border px-3 py-3 text-left transition ${
                      active
                        ? "border-teal-700 bg-teal-50 shadow-sm ring-1 ring-teal-700"
                        : "border-stone-200 bg-stone-50 hover:border-teal-500"
                    }`}
                  >
                    <p className="text-sm font-semibold text-stone-900">{meta.label}</p>
                    <p className="mt-1 text-xs leading-snug text-stone-600">{meta.blurb}</p>
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
                  ? "Thinking & tailoring…"
                  : `Apply ${TAILOR_INTENSITY_META[intensity].label}`}
              </button>
              <button
                type="button"
                disabled={!!busy || !hasSource}
                onClick={resetToOriginal}
                className="rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
              >
                Reset to original
              </button>
            </div>
          </section>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          {thinking.length ? (
            <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Thinking
              </h2>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-stone-700">
                {thinking.map((step, i) => (
                  <li key={`${i}-${step.slice(0, 24)}`}>{step}</li>
                ))}
              </ol>
            </section>
          ) : null}

          {score ? (
            <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                    ATS score
                    {appliedIntensity ? (
                      <span className="ml-2 rounded bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                        {appliedIntensity}
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-1 text-3xl font-semibold tracking-tight">
                    {score.matchRate}%
                    <span className="ml-2 text-sm font-normal text-stone-500">
                      target {score.target}%
                    </span>
                  </p>
                  <p className="text-xs text-stone-500">
                    Keywords {score.keywordScore}% · TF-IDF {score.similarity ?? "—"}% · Format{" "}
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
                  <p className="text-xs font-semibold uppercase text-teal-800">Hits</p>
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
                      <span className="text-xs text-stone-500">No high-signal overlaps yet</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-amber-800">Honest gaps</p>
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
                      <span className="text-xs text-stone-500">No major gaps</span>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:hidden">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Live preview
              </h2>
              <div className="ml-auto flex gap-1 rounded-md border border-stone-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewTab("preview")}
                  className={`rounded px-2 py-1 text-xs font-medium ${viewTab === "preview" ? "bg-stone-900 text-white" : "text-stone-600"}`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab("edit")}
                  className={`rounded px-2 py-1 text-xs font-medium ${viewTab === "edit" ? "bg-stone-900 text-white" : "text-stone-600"}`}
                >
                  Edit
                </button>
              </div>
            </div>
            {viewTab === "preview" ? (
              <>
                {hasSource && appliedIntensity ? (
                  <label className="mb-2 flex items-center gap-2 text-xs text-stone-600">
                    <input
                      type="checkbox"
                      checked={showOriginal}
                      onChange={(e) => setShowOriginal(e.target.checked)}
                    />
                    Compare with original
                  </label>
                ) : null}
                <ResumePreview resume={previewResume} intensity={showOriginal ? null : appliedIntensity} />
              </>
            ) : (
              <EditPanel
                resume={resume}
                setResume={setResume}
                updateContactField={updateContactField}
                setError={setError}
              />
            )}
          </section>
        </div>

        {/* Sticky live preview (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Live preview
              </h2>
              <div className="ml-auto flex gap-1 rounded-md border border-stone-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setViewTab("preview")}
                  className={`rounded px-2 py-1 text-xs font-medium ${viewTab === "preview" ? "bg-stone-900 text-white" : "text-stone-600"}`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab("edit")}
                  className={`rounded px-2 py-1 text-xs font-medium ${viewTab === "edit" ? "bg-stone-900 text-white" : "text-stone-600"}`}
                >
                  Edit
                </button>
              </div>
            </div>
            {hasSource && appliedIntensity ? (
              <label className="flex items-center gap-2 text-xs text-stone-600">
                <input
                  type="checkbox"
                  checked={showOriginal}
                  onChange={(e) => setShowOriginal(e.target.checked)}
                />
                Compare with original
              </label>
            ) : null}
            {viewTab === "preview" ? (
              <ResumePreview
                resume={previewResume}
                intensity={showOriginal ? null : appliedIntensity}
              />
            ) : (
              <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                <EditPanel
                  resume={resume}
                  setResume={setResume}
                  updateContactField={updateContactField}
                  setError={setError}
                />
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!!busy || !hasSource}
                onClick={() => exportFile("pdf")}
                className="flex-1 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy === "pdf" ? "Building…" : "PDF"}
              </button>
              <button
                type="button"
                disabled={!!busy || !hasSource}
                onClick={() => exportFile("docx")}
                className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {busy === "docx" ? "Building…" : "DOCX"}
              </button>
            </div>
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
        rows={14}
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

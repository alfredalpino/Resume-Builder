"use client";

import { useMemo, useState } from "react";
import type { AtsScore, StructuredResume } from "@/lib/schema";
import { emptyResume } from "@/lib/schema";
import { GEMINI_KEY_HEADER } from "@/lib/constants";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { SignOutButton } from "@/components/auth-buttons";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
};

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

export function Workspace({ userName, userEmail }: Props) {
  const [useGeminiEnhance, setUseGeminiEnhance] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState<string>(GEMINI_MODELS[0]);
  const [rawText, setRawText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resume, setResume] = useState<StructuredResume>(emptyResume());
  const [score, setScore] = useState<AtsScore | null>(null);
  const [thinking, setThinking] = useState<string[]>([]);
  const [engine, setEngine] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    if (geminiKey.trim()) h[GEMINI_KEY_HEADER] = geminiKey.trim();
    return h;
  }, [geminiKey]);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setBusy("parse");
    setError(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse", { method: "POST", headers, body: form });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { rawText: string; resume: StructuredResume };
      setRawText(data.rawText);
      setResume(data.resume);
      setScore(null);
      setThinking([]);
      setEngine(null);
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
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { resume: StructuredResume };
      setResume(data.resume);
      setScore(null);
      setThinking([]);
      setEngine(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setBusy(null);
    }
  }

  async function tailor() {
    if (!jobDescription.trim()) {
      setError("Paste a job description");
      return;
    }
    if (useGeminiEnhance && !geminiKey.trim()) {
      setError("Turn off Gemini enhance, or paste a Gemini key");
      return;
    }
    setBusy("tailor");
    setError(null);
    setWarning(null);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          resume,
          jobDescription,
          mode: useGeminiEnhance ? "gemini" : "smart",
          model: geminiModel,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        resume: StructuredResume;
        score: AtsScore;
        engine?: string;
        warning?: string;
      };
      setResume(data.resume);
      setScore(data.score);
      setThinking(data.score.thinking || []);
      setEngine(data.engine || "smart");
      if (data.warning) setWarning(data.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tailoring failed");
    } finally {
      setBusy(null);
    }
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
      downloadBlob(blob, `${base}_ATS.${kind}`);
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
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-lg font-semibold tracking-tight">Resume-Builder</p>
            <p className="text-xs text-stone-500">
              {userName || userEmail || "user"} · Smart Thinking locked on · no keyword spam
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                Engine
              </p>
              <h2 className="mt-1 text-base font-semibold text-stone-900">
                Smart Thinking (default — always on)
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-stone-600">
                Analyzes the JD for real skills/tools/roles, maps them to your resume evidence,
                reorders content, and never invents facts or stuffs filler words like “not / help / do”.
              </p>
            </div>
            <span className="rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">
              Locked
            </span>
          </div>

          <details className="mt-4 rounded-lg border border-stone-200 bg-white/80 p-3">
            <summary className="cursor-pointer text-sm font-medium text-stone-700">
              Optional: Gemini enhance (after Smart Thinking)
            </summary>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useGeminiEnhance}
                  onChange={(e) => setUseGeminiEnhance(e.target.checked)}
                />
                Also run Gemini refine (falls back to Smart Thinking if quota fails)
              </label>
              {useGeminiEnhance ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="password"
                    autoComplete="off"
                    placeholder="Gemini API key"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
                  />
                  <select
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    className="rounded-md border border-stone-300 px-3 py-2 text-sm"
                  >
                    {GEMINI_MODELS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </details>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Resume
            </h2>
            <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center transition hover:border-teal-600 hover:bg-teal-50/40">
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
              rows={10}
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
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Job description
            </h2>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description…"
              rows={16}
              className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
            <button
              type="button"
              disabled={!!busy}
              onClick={tailor}
              className="mt-3 w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {busy === "tailor" ? "Thinking & tailoring…" : "Tailor with Smart Thinking"}
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {warning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {warning}
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
                  <span className="ml-2 rounded bg-teal-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-800">
                    {engine === "gemini+smart" ? "Smart + Gemini" : "Smart Thinking"}
                  </span>
                </h2>
                <p className="mt-1 text-3xl font-semibold tracking-tight">
                  {score.matchRate}%
                  <span className="ml-2 text-sm font-normal text-stone-500">
                    target {score.target}%
                  </span>
                </p>
                <p className="text-xs text-stone-500">
                  Keywords {score.keywordScore}% · Format {score.formatScore}%
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
                <p className="text-xs font-semibold uppercase text-amber-800">
                  Honest gaps
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
                    <span className="text-xs text-stone-500">No major gaps</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Edit
            </h2>
            <div className="mt-3 grid gap-2">
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
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Preview
            </h2>
            <article className="mt-3 max-h-[720px] overflow-auto rounded-md border border-stone-200 bg-white p-8 text-[10.5px] leading-[1.35] text-[#111]">
              <h1 className="text-center text-[18px] font-bold tracking-wide">
                {resume.contact.fullName.toUpperCase()}
              </h1>
              {resume.headline ? (
                <p className="mt-1 text-center text-[10.5px] font-semibold">
                  {resume.headline}
                </p>
              ) : null}
              <p className="mt-1 text-center text-[9px]">
                {[resume.contact.email, resume.contact.phone, resume.contact.location]
                  .filter(Boolean)
                  .join("  ·  ")}
                {resume.contact.links.length
                  ? `${[resume.contact.email, resume.contact.phone, resume.contact.location].some(Boolean) ? "  ·  " : ""}${resume.contact.links
                      .map((l) => l.label)
                      .join("  ·  ")}`
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
                    Technical Skills
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
            {!score ? (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => exportFile("pdf")}
                  className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => exportFile("docx")}
                  className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Download DOCX
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

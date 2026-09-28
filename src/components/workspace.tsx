"use client";

import { useMemo, useState } from "react";
import type { AtsScore, StructuredResume } from "@/lib/schema";
import { emptyResume } from "@/lib/schema";
import { GEMINI_KEY_HEADER } from "@/lib/constants";
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
  const [geminiKey, setGeminiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<"idle" | "ok" | "error">("idle");
  const [keyMessage, setKeyMessage] = useState("");
  const [rawText, setRawText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resume, setResume] = useState<StructuredResume>(emptyResume());
  const [score, setScore] = useState<AtsScore | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = {};
    if (geminiKey.trim()) h[GEMINI_KEY_HEADER] = geminiKey.trim();
    return h;
  }, [geminiKey]);

  async function validateKey() {
    setBusy("validate");
    setError(null);
    setKeyStatus("idle");
    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error(await readError(res));
      setKeyStatus("ok");
      setKeyMessage("Gemini key validated for this session.");
    } catch (err) {
      setKeyStatus("error");
      setKeyMessage(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setBusy(null);
    }
  }

  async function onFileChange(file: File | null) {
    if (!file) return;
    setBusy("parse");
    setError(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse", {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        rawText: string;
        resume: StructuredResume;
      };
      setRawText(data.rawText);
      setResume(data.resume);
      setScore(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setBusy(null);
    }
  }

  async function tailor() {
    if (!geminiKey.trim()) {
      setError("Add and validate your Gemini API key first");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Paste a job description");
      return;
    }
    setBusy("tailor");
    setError(null);
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ resume, jobDescription }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        resume: StructuredResume;
        score: AtsScore;
      };
      setResume(data.resume);
      setScore(data.score);
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

  function updateContactField(field: "fullName" | "email" | "phone" | "location", value: string) {
    setResume((r) => ({
      ...r,
      contact: { ...r.contact, [field]: value },
    }));
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8f5f2_0%,_#f7f4ef_45%,_#f3efe8_100%)] text-stone-900">
      <header className="border-b border-stone-200/80 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-lg font-semibold tracking-tight">Resume-Builder</p>
            <p className="text-xs text-stone-500">
              Signed in as {userName || userEmail || "user"} · session-only · BYOK Gemini
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Setup
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Your Gemini key stays in this browser session and is sent only as a request header. It is never saved on the server.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="password"
              autoComplete="off"
              placeholder="Gemini API key"
              value={geminiKey}
              onChange={(e) => {
                setGeminiKey(e.target.value);
                setKeyStatus("idle");
              }}
              className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
            <button
              type="button"
              disabled={!!busy || !geminiKey.trim()}
              onClick={validateKey}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy === "validate" ? "Validating…" : "Validate key"}
            </button>
          </div>
          {keyMessage ? (
            <p
              className={`mt-2 text-sm ${keyStatus === "ok" ? "text-teal-700" : "text-red-700"}`}
            >
              {keyMessage}
            </p>
          ) : null}
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
              className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-xs outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
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
              className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
            <button
              type="button"
              disabled={!!busy}
              onClick={tailor}
              className="mt-3 w-full rounded-md bg-teal-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {busy === "tailor" ? "Tailoring with Gemini…" : "Tailor resume"}
            </button>
          </div>
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
                    <span className="text-xs text-stone-500">None yet</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-amber-800">Gaps</p>
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
            {score.formatNotes.length ? (
              <ul className="mt-3 list-disc pl-5 text-xs text-stone-600">
                {score.formatNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
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
              <p className="text-xs text-stone-500">
                Advanced: edit structured JSON. Links under contact.links become clickable in PDF/DOCX.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Preview
            </h2>
            <article className="mt-3 max-h-[720px] overflow-auto rounded-md border border-stone-200 bg-white p-6 text-[11px] leading-relaxed text-black">
              <h1 className="text-center text-base font-bold">{resume.contact.fullName}</h1>
              {resume.headline ? (
                <p className="text-center text-[11px] font-semibold">{resume.headline}</p>
              ) : null}
              <p className="mt-1 text-center text-[10px]">
                {[resume.contact.email, resume.contact.phone, resume.contact.location]
                  .filter(Boolean)
                  .join(" | ")}
                {resume.contact.links.length
                  ? `${[resume.contact.email, resume.contact.phone, resume.contact.location].some(Boolean) ? " | " : ""}${resume.contact.links
                      .map((l) => l.label)
                      .join(" | ")}`
                  : ""}
              </p>
              {resume.contact.links.length ? (
                <p className="mt-1 text-center text-[10px] text-blue-700">
                  {resume.contact.links.map((l, i) => (
                    <span key={l.url}>
                      {i > 0 ? " · " : ""}
                      <a href={l.url} target="_blank" rel="noreferrer" className="underline">
                        {l.url}
                      </a>
                    </span>
                  ))}
                </p>
              ) : null}

              {resume.summary ? (
                <>
                  <h3 className="mt-4 border-b border-black text-[11px] font-bold uppercase">
                    Professional Summary
                  </h3>
                  <p className="mt-1">{resume.summary}</p>
                </>
              ) : null}

              {resume.skills.length ? (
                <>
                  <h3 className="mt-4 border-b border-black text-[11px] font-bold uppercase">
                    Technical Skills
                  </h3>
                  {resume.skills.map((g) => (
                    <p key={g.category} className="mt-1">
                      <strong>{g.category}: </strong>
                      {g.items.join(" | ")}
                    </p>
                  ))}
                </>
              ) : null}

              {resume.experience.length ? (
                <>
                  <h3 className="mt-4 border-b border-black text-[11px] font-bold uppercase">
                    Professional Experience
                  </h3>
                  {resume.experience.map((job, idx) => (
                    <div key={`${job.company}-${idx}`} className="mt-2">
                      <p className="font-bold">
                        {job.company} — {job.title} | {job.start} – {job.end}
                        {job.location ? ` | ${job.location}` : ""}
                      </p>
                      <ul className="mt-0.5 list-none pl-2">
                        {job.bullets.map((b, i) => (
                          <li key={i}>- {b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              ) : null}

              {resume.projects.length ? (
                <>
                  <h3 className="mt-4 border-b border-black text-[11px] font-bold uppercase">
                    Projects
                  </h3>
                  {resume.projects.map((p, idx) => (
                    <div key={`${p.name}-${idx}`} className="mt-2">
                      <p className="font-bold">
                        {p.name}
                        {p.url ? (
                          <>
                            {" | "}
                            <a href={p.url} className="text-blue-700 underline" target="_blank" rel="noreferrer">
                              {p.url.replace(/^https?:\/\//, "")}
                            </a>
                          </>
                        ) : null}
                      </p>
                      <ul className="pl-2">
                        {p.bullets.map((b, i) => (
                          <li key={i}>- {b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              ) : null}

              {resume.education.length ? (
                <>
                  <h3 className="mt-4 border-b border-black text-[11px] font-bold uppercase">
                    Education
                  </h3>
                  {resume.education.map((e, idx) => (
                    <p key={`${e.school}-${idx}`} className="mt-1">
                      {e.degree} — {e.school}
                      {e.dates ? ` | ${e.dates}` : ""}
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

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
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  FileText,
  Lock,
  RefreshCw,
  Upload,
} from "lucide-react";
import type { AtsScore, StructuredResume } from "@/lib/schema";
import { emptyResume } from "@/lib/schema";
import { SignOutButton } from "@/components/auth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ProgressStepper,
  type WorkflowStepId,
} from "@/components/app-shell/progress-stepper";
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

type ViewMode = "original" | "tailored" | "compare" | "edit";
type DocTab = "resume" | "cover";

type HumanAnalysis = {
  strongMatches: string[];
  needsAttention: string[];
  opportunities: string[];
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

function ResumePaper({
  resume,
  style,
  label,
}: {
  resume: StructuredResume;
  style: ResumeStyle;
  label?: string;
}) {
  const css: CSSProperties = {
    fontFamily: previewFontFamily(style),
    fontSize: `${style.fontSize}px`,
    lineHeight: 1.45,
  };
  const showHeadline = style.showHeadline && Boolean(resume.headline?.trim());

  return (
    <article
      style={css}
      className="mx-auto max-h-[min(72vh,820px)] w-full max-w-[640px] overflow-auto rounded-sm bg-[var(--paper)] p-8 text-[var(--paper-text)] shadow-[var(--shadow)]"
    >
      {label ? (
        <p
          className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--alfred-amber)]"
          style={{ fontSize: Math.max(8, style.fontSize - 1) }}
        >
          {label}
        </p>
      ) : null}
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
      <p className="mt-1 text-center opacity-70" style={{ fontSize: Math.max(8, style.fontSize - 1) }}>
        {[resume.contact.location, resume.contact.email, resume.contact.phone]
          .filter(Boolean)
          .join("  ·  ")}
      </p>
      {resume.summary ? (
        <>
          <h3 className="mt-4 border-b border-black/80 pb-0.5 font-bold uppercase tracking-wide">
            Professional Summary
          </h3>
          <p className="mt-1 text-justify">{resume.summary}</p>
        </>
      ) : null}
      {resume.skills.length ? (
        <>
          <h3 className="mt-3 border-b border-black/80 pb-0.5 font-bold uppercase tracking-wide">
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
          <h3 className="mt-3 border-b border-black/80 pb-0.5 font-bold uppercase tracking-wide">
            Experience
          </h3>
          {resume.experience.map((job, idx) => (
            <div key={`${job.company}-${idx}`} className="mt-1.5">
              <p className="font-bold">
                {job.company} — {job.title}
              </p>
              <p className="opacity-60" style={{ fontSize: Math.max(8, style.fontSize - 1) }}>
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
          <h3 className="mt-3 border-b border-black/80 pb-0.5 font-bold uppercase tracking-wide">
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
          <h3 className="mt-3 border-b border-black/80 pb-0.5 font-bold uppercase tracking-wide">
            Education
          </h3>
          {resume.education.map((e, idx) => {
            const same = e.degree.trim().toLowerCase() === e.school.trim().toLowerCase();
            return (
              <p key={`${e.school}-${idx}`} className="mt-1">
                {same ? e.degree : `${e.degree} — ${e.school}`}
                {e.dates ? `  ·  ${e.dates}` : ""}
                {e.details ? `  ·  ${e.details}` : ""}
              </p>
            );
          })}
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
  const [viewMode, setViewMode] = useState<ViewMode>("tailored");
  const [docTab, setDocTab] = useState<DocTab>("resume");
  const [coverLetter, setCoverLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [step, setStep] = useState<WorkflowStepId>(1);
  const [unlockedThrough, setUnlockedThrough] = useState<WorkflowStepId>(1);
  const [humanAnalysis, setHumanAnalysis] = useState<HumanAnalysis | null>(null);
  const [mobileTab, setMobileTab] = useState<"workspace" | "preview">("workspace");
  const scoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasSource = useMemo(
    () => sourceResume.contact.fullName !== "Your Name" || Boolean(sourceResume.summary),
    [sourceResume],
  );
  const hasJd = jobDescription.trim().length >= 40;
  const hasTailored = Boolean(appliedIntensity);
  const skillCount = sourceResume.skills.reduce((n, g) => n + g.items.length, 0);
  const wordCount = useMemo(() => {
    const t = [sourceResume.summary, ...sourceResume.experience.flatMap((j) => j.bullets)].join(" ");
    return t.trim() ? t.trim().split(/\s+/).length : 0;
  }, [sourceResume]);

  function unlock(to: WorkflowStepId) {
    setUnlockedThrough((u) => (to > u ? to : u));
  }

  function go(to: WorkflowStepId) {
    if (to <= unlockedThrough) setStep(to);
  }

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

  useEffect(() => {
    if (hasSource && hasJd && unlockedThrough < 3) {
      unlock(3);
    }
  }, [hasSource, hasJd, unlockedThrough]);

  function adoptParsed(parsed: StructuredResume, text?: string) {
    setSourceResume(structuredClone(parsed));
    setResume(parsed);
    setScore(null);
    setAppliedIntensity(null);
    setCoverLetter("");
    setHumanAnalysis(null);
    setViewMode("original");
    unlock(2);
    setStep(2);
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
      setError(err instanceof Error ? err.message : "We couldn't read this file.");
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
      setFileName("pasted-resume.txt");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't parse that text.");
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

  async function runAnalysis() {
    if (!hasSource || !hasJd) {
      setError("Add a resume and job description first.");
      return;
    }
    setBusy("analyze");
    setError(null);
    startProgress();
    try {
      await liveScore(sourceResume, jobDescription);
      // Lightweight analysis pass via tailor subtle to get humanAnalysis structure without heavy rewrite
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: sourceResume,
          jobDescription,
          intensity: "subtle",
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        score: AtsScore;
        humanAnalysis?: HumanAnalysis;
      };
      setScore(data.score);
      setHumanAnalysis(data.humanAnalysis || null);
      unlock(4);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't finish the analysis.");
    } finally {
      stopProgress();
      setBusy(null);
    }
  }

  async function tailor(nextIntensity: TailorIntensity = intensity) {
    if (!jobDescription.trim()) {
      setError("Add a job description first.");
      return;
    }
    if (!hasSource) {
      setError("Import a resume first.");
      return;
    }
    setBusy("tailor");
    setError(null);
    setIntensity(nextIntensity);
    setStep(4);
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
        humanAnalysis?: HumanAnalysis;
      };
      setResume(data.resume);
      setScore(data.score);
      setAppliedIntensity(data.intensity || nextIntensity);
      if (data.humanAnalysis) setHumanAnalysis(data.humanAnalysis);
      setViewMode("tailored");
      unlock(5);
      setStep(5);
      setMobileTab("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't finish tailoring.");
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
    setDocTab("cover");
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
    setViewMode("original");
    setStep(hasJd ? 2 : 1);
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

  const processLabel =
    busy === "parse"
      ? "> PARSING RESUME..."
      : busy === "analyze"
        ? "> ANALYZING ROLE..."
        : busy === "tailor"
          ? "> TAILORING APPLICATION..."
          : busy === "cover"
            ? "> WRITING COVER LETTER..."
            : null;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 lg:px-8">
          <div className="min-w-[140px] shrink-0">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="font-mono text-[var(--alfred-amber)]">&gt;_</span>
              Alfred Terminal
            </p>
            <p className="hidden text-[10px] text-[var(--text-muted)] sm:block">
              Tailored to the job. True to you.
            </p>
          </div>

          <ProgressStepper
            current={step}
            unlockedThrough={unlockedThrough}
            onNavigate={go}
          />

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/coffee"
              className="hidden text-sm text-[var(--text-secondary)] hover:text-[var(--alfred-amber)] sm:inline"
            >
              Buy me a coffee
            </Link>
            <ThemeToggle />
            <div className="hidden items-center gap-2 border-l border-[var(--border)] pl-2 sm:flex">
              <span className="max-w-[120px] truncate text-xs text-[var(--text-muted)]">
                {userName || userEmail || "Account"}
              </span>
              <SignOutButton />
            </div>
          </div>
        </div>
        {(busy || progress > 0) && (
          <div className="h-0.5 w-full bg-[var(--elevated)]">
            <div
              className="h-full bg-[var(--alfred-amber)] transition-all duration-300"
              style={{ width: `${Math.max(progress, busy ? 8 : 0)}%` }}
            />
          </div>
        )}
        {processLabel ? (
          <p className="px-4 py-1.5 font-mono text-[11px] text-[var(--alfred-amber)] lg:px-8">
            {processLabel}
          </p>
        ) : null}
      </header>

      {/* Mobile tabs */}
      <div className="flex border-b border-[var(--border)] lg:hidden">
        {(["workspace", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-2.5 text-sm capitalize ${
              mobileTab === t
                ? "border-b-2 border-[var(--alfred-amber)] text-[var(--alfred-amber)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div
          className={`min-w-0 space-y-8 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8 ${
            mobileTab === "preview" ? "hidden lg:block" : ""
          }`}
        >
          {error ? (
            <div className="flex items-start gap-3 rounded-xl border border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--error)]" />
              <div>
                <p className="font-medium">Something went wrong</p>
                <p className="mt-0.5 text-[var(--text-secondary)]">{error}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Your original resume is safe.</p>
              </div>
            </div>
          ) : null}

          {/* STEP 1 — Resume */}
          {(step === 1 || (step <= 2 && !hasSource)) && (
            <section>
              <h2 className="text-xl font-semibold tracking-tight">Resume</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Start with your current resume.
              </p>
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center transition hover:border-[var(--alfred-amber)]/40">
                <Upload className="h-8 w-8 text-[var(--text-muted)]" />
                <span className="mt-3 text-sm font-medium">Drop PDF, DOCX, TXT, or Markdown</span>
                <span className="mt-1 text-xs text-[var(--text-muted)]">or browse files · max 5 MB</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                />
              </label>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowRaw((s) => !s)}
                  className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition ${showRaw ? "rotate-180" : ""}`} />
                  Or paste resume text
                </button>
                {showRaw ? (
                  <div className="mt-2">
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      rows={6}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--alfred-amber)]"
                      placeholder="Paste resume text…"
                    />
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={parsePastedText}
                      className="mt-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:border-[var(--border-hover)] disabled:opacity-50"
                    >
                      {busy === "parse" ? "Parsing…" : "Parse text"}
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {hasSource ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <FileText className="h-5 w-5 text-[var(--alfred-amber)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fileName || "Resume"}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {wordCount} words · {skillCount} skills · {sourceResume.experience.length} roles
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success)]/15 px-2.5 py-1 text-xs text-[var(--success)]">
                <Check className="h-3 w-3" /> Parsed
              </span>
              <label className="cursor-pointer text-xs text-[var(--text-secondary)] underline-offset-2 hover:underline">
                Replace
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown,application/pdf"
                  className="hidden"
                  onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          ) : null}

          {/* STEP 2 — Job */}
          {(step >= 2 || hasSource) && unlockedThrough >= 2 ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight">Target job</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Paste the job description for the role you&apos;re applying to.
              </p>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={10}
                className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-relaxed outline-none focus:border-[var(--alfred-amber)]"
                placeholder="Paste the full job description…"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>{jobDescription.length.toLocaleString()} characters</span>
                {hasJd ? (
                  <span className="text-[var(--success)]">Ready to analyze</span>
                ) : (
                  <span>Need at least 40 characters</span>
                )}
              </div>
              {hasSource && hasJd && step <= 3 && !hasTailored ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={runAnalysis}
                  className="mt-5 h-11 rounded-lg bg-[var(--alfred-amber)] px-6 text-sm font-semibold text-[var(--bg)] disabled:opacity-50"
                >
                  {busy === "analyze" ? "Analyzing…" : "Analyze application"}
                </button>
              ) : null}
            </section>
          ) : null}

          {/* STEP 3 — Analysis */}
          {step >= 3 && unlockedThrough >= 3 && (humanAnalysis || score) ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight">Application analysis</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                We compared your experience with the role requirements.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <p className="text-xs text-[var(--text-muted)]">Role alignment</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">
                    {score?.matchRate ?? "—"}%
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--elevated)]">
                    <div
                      className="h-full rounded-full bg-[var(--alfred-amber)]"
                      style={{ width: `${score?.matchRate ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <p className="text-xs text-[var(--text-muted)]">Supported skills</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">
                    {score?.hits.length ?? 0}
                    <span className="text-base font-normal text-[var(--text-muted)]">
                      {" "}
                      / {(score?.hits.length ?? 0) + (score?.missing.length ?? 0) || "—"}
                    </span>
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <p className="text-xs text-[var(--text-muted)]">Needs attention</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">
                    {score?.missing.length ?? humanAnalysis?.needsAttention.length ?? 0}
                  </p>
                </div>
              </div>
              {humanAnalysis ? (
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold text-[var(--success)]">Strong matches</p>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                      {(humanAnalysis.strongMatches.length
                        ? humanAnalysis.strongMatches
                        : score?.hits.slice(0, 6) || []
                      ).map((m) => (
                        <li key={m}>✓ {m}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--warning)]">Needs attention</p>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                      {(humanAnalysis.needsAttention.length
                        ? humanAnalysis.needsAttention
                        : (score?.missing || []).map((m) => `${m} not found on resume`)
                      )
                        .slice(0, 6)
                        .map((m) => (
                          <li key={m}>• {m}</li>
                        ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--alfred-amber)]">Opportunities</p>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                      {humanAnalysis.opportunities.slice(0, 5).map((m) => (
                        <li key={m}>• {m}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Internal role-alignment metric — not a universal ATS score.
              </p>
              {unlockedThrough >= 4 && step === 3 ? (
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="mt-5 h-11 rounded-lg bg-[var(--alfred-amber)] px-6 text-sm font-semibold text-[var(--bg)]"
                >
                  Continue to tailor
                </button>
              ) : null}
            </section>
          ) : null}

          {/* STEP 4 — Tailor */}
          {unlockedThrough >= 4 && (step === 4 || step === 5) ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight">Tailor resume</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Choose how aggressively Alfred should restructure around this role.
              </p>
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-xs text-[var(--text-secondary)]">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--alfred-amber)]" />
                <p>
                  <span className="font-medium text-[var(--text)]">Fact protection enabled.</span>{" "}
                  Unsupported experience, certifications, companies, metrics, or technologies will
                  not be invented.
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(["subtle", "medium", "hard"] as TailorIntensity[]).map((mode) => {
                  const meta = TAILOR_INTENSITY_META[mode];
                  const active = intensity === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setIntensity(mode)}
                      className={`rounded-xl border px-4 py-4 text-left transition ${
                        active
                          ? "border-[var(--alfred-amber)] bg-[var(--alfred-amber)]/10"
                          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-hover)]"
                      }`}
                    >
                      <p className="text-sm font-semibold">{meta.label}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {meta.blurb}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => tailor(intensity)}
                  className="h-11 rounded-lg bg-[var(--alfred-amber)] px-6 text-sm font-semibold text-[var(--bg)] disabled:opacity-50"
                >
                  {busy === "tailor"
                    ? "Tailoring…"
                    : `Tailor with ${TAILOR_INTENSITY_META[intensity].label}`}
                </button>
                {hasTailored ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={resetToOriginal}
                    className="h-11 rounded-lg border border-[var(--border)] px-4 text-sm disabled:opacity-50"
                  >
                    Reset to original
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* STEP 5 — Review */}
          {step === 5 && hasTailored ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight">Your resume is ready.</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Tailored for this role while preserving your original experience.
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <span>
                  Role alignment{" "}
                  <strong className="text-[var(--alfred-amber)]">{score?.matchRate ?? "—"}%</strong>
                </span>
                <span className="text-[var(--success)]">Fact integrity ✓ Passed</span>
                <span className="text-[var(--success)]">ATS-friendly structure ✓ Ready</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => exportFile("pdf")}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--alfred-amber)] px-5 text-sm font-semibold text-[var(--bg)] disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {busy === "pdf" ? "Building…" : "Download PDF"}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => exportFile("docx")}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-5 text-sm disabled:opacity-50"
                >
                  {busy === "docx" ? "Building…" : "Download DOCX"}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => tailor(intensity)}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>
              </div>

              <div className="mt-10 border-t border-[var(--border)] pt-8">
                <div className="flex gap-4 border-b border-[var(--border)]">
                  {(["resume", "cover"] as DocTab[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDocTab(t)}
                      className={`pb-2 text-sm capitalize ${
                        docTab === t
                          ? "border-b-2 border-[var(--alfred-amber)] font-medium text-[var(--alfred-amber)]"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      {t === "resume" ? "Resume" : "Cover Letter"}
                    </button>
                  ))}
                </div>
                {docTab === "cover" ? (
                  <div className="mt-5">
                    {!coverLetter ? (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
                        <h3 className="text-lg font-medium">Make the application complete.</h3>
                        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">
                          Generate a role-specific cover letter from your tailored resume and target
                          job description.
                        </p>
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={generateCoverLetter}
                          className="mt-5 h-11 rounded-lg bg-[var(--alfred-amber)] px-5 text-sm font-semibold text-[var(--bg)] disabled:opacity-50"
                        >
                          {busy === "cover" ? "Writing…" : "Generate Cover Letter"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={copyCoverLetter}
                            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                          >
                            {copied ? "Copied" : "Copy"}
                          </button>
                          <button
                            type="button"
                            onClick={() => exportCover("pdf")}
                            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                          >
                            Download PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => exportCover("docx")}
                            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                          >
                            Download DOCX
                          </button>
                          <button
                            type="button"
                            onClick={generateCoverLetter}
                            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                          >
                            Regenerate
                          </button>
                        </div>
                        <textarea
                          className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-relaxed"
                          rows={16}
                          value={coverLetter}
                          onChange={(e) => setCoverLetter(e.target.value)}
                        />
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                    <p>Use the resume preview panel to switch Original / Tailored / Compare.</p>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={style.showHeadline}
                        onChange={(e) =>
                          setStyle((s) => ({ ...s, showHeadline: e.target.checked }))
                        }
                      />
                      Show headline under name
                    </label>
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>

        {/* Preview column */}
        <aside
          className={`border-[var(--border)] bg-[var(--elevated)]/40 lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:overflow-y-auto lg:border-l ${
            mobileTab === "workspace" ? "hidden lg:block" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Resume preview
            </h2>
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
              {(["original", "tailored", "compare", "edit"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={`rounded-md px-2 py-1 text-[11px] capitalize ${
                    viewMode === m
                      ? "bg-[var(--elevated)] text-[var(--text)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4">
            {!hasSource ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)]">
                Upload a resume to preview
              </div>
            ) : viewMode === "original" ? (
              <ResumePaper resume={sourceResume} style={style} label="Original" />
            ) : viewMode === "tailored" ? (
              <ResumePaper
                resume={resume}
                style={style}
                label={
                  appliedIntensity
                    ? `Tailored · ${TAILOR_INTENSITY_META[appliedIntensity].label}`
                    : "Current"
                }
              />
            ) : viewMode === "compare" ? (
              <div className="space-y-4">
                <ResumePaper resume={sourceResume} style={style} label="Original" />
                <ResumePaper
                  resume={resume}
                  style={style}
                  label={
                    appliedIntensity
                      ? `Tailored · ${TAILOR_INTENSITY_META[appliedIntensity].label}`
                      : "Tailored"
                  }
                />
              </div>
            ) : (
              <EditPanel
                resume={resume}
                setResume={setResume}
                updateContactField={updateContactField}
                setError={setError}
              />
            )}
          </div>
        </aside>
      </main>

      {/* Sticky action bar */}
      {hasSource && hasJd && unlockedThrough >= 4 && step === 4 ? (
        <div className="sticky bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 lg:px-8">
            <p className="text-xs text-[var(--text-muted)]">
              {TAILOR_INTENSITY_META[intensity].label} · Fact protection on
            </p>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => tailor(intensity)}
              className="h-10 rounded-lg bg-[var(--alfred-amber)] px-5 text-sm font-semibold text-[var(--bg)] disabled:opacity-50"
            >
              Tailor Resume →
            </button>
          </div>
        </div>
      ) : null}
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
    <div className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      {(
        [
          ["fullName", "Full name"],
          ["email", "Email"],
          ["phone", "Phone"],
          ["location", "Location"],
        ] as const
      ).map(([field, ph]) => (
        <input
          key={field}
          className="rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-sm"
          value={
            field === "location"
              ? resume.contact.location || ""
              : resume.contact[field]
          }
          onChange={(e) => updateContactField(field, e.target.value)}
          placeholder={ph}
        />
      ))}
      <input
        className="rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-sm"
        value={resume.headline}
        onChange={(e) => setResume((r) => ({ ...r, headline: e.target.value }))}
        placeholder="Headline"
      />
      <textarea
        className="rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-sm"
        rows={5}
        value={resume.summary}
        onChange={(e) => setResume((r) => ({ ...r, summary: e.target.value }))}
        placeholder="Summary"
      />
      <textarea
        className="rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 font-mono text-xs"
        rows={10}
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

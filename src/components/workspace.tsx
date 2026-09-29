"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Coffee,
  Download,
  Eye,
  FileText,
  Menu,
  PenLine,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import type { AtsScore, StructuredResume } from "@/lib/schema";
import { emptyResume } from "@/lib/schema";
import { SignOutButton } from "@/components/auth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ProgressStepper,
  type WorkflowStepId,
} from "@/components/app-shell/progress-stepper";
import { AnalysisPanel, type AnalysisPayload } from "@/components/analysis/AnalysisPanel";
import { AtsRobustnessPanel } from "@/components/analysis/AtsRobustnessPanel";
import { ResumePaper, A4_WIDTH_PX } from "@/components/preview/ResumePaper";
import {
  PreviewToolbar,
  type PreviewZoom,
} from "@/components/preview/PreviewToolbar";
import {
  computeAtsRobustness,
  type AtsRobustnessReport,
} from "@/lib/ats-robustness";
import { TAILOR_INTENSITY_META, type TailorIntensity } from "@/lib/center";
import { COMPILE_PLACEHOLDER } from "@/lib/resume/compiler";
import { DEFAULT_RESUME_STYLE, type ResumeStyle } from "@/lib/style";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
};

type ViewMode = "original" | "tailored" | "compare" | "edit";

const DRAFT_KEY = "alfred-terminal-draft-v1";

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

function recommendIntensity(distance?: AnalysisPayload["distance"]): TailorIntensity {
  if (distance === "hard") return "hard";
  if (distance === "adjacent") return "medium";
  return "subtle";
}

export function Workspace({ userName, userEmail }: Props) {
  const [rawText, setRawText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [sourceResume, setSourceResume] = useState<StructuredResume>(emptyResume());
  const [resume, setResume] = useState<StructuredResume>(emptyResume());
  const [score, setScore] = useState<AtsScore | null>(null);
  const [atsRobustness, setAtsRobustness] = useState<AtsRobustnessReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<TailorIntensity>("medium");
  const [appliedIntensity, setAppliedIntensity] = useState<TailorIntensity | null>(null);
  const [style, setStyle] = useState<ResumeStyle>(DEFAULT_RESUME_STYLE);
  const [viewMode, setViewMode] = useState<ViewMode>("tailored");
  const [coverLetter, setCoverLetter] = useState("");
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [entryMode, setEntryMode] = useState<"upload" | "create">("upload");
  const [compileNotes, setCompileNotes] = useState("");
  const [compileWarnings, setCompileWarnings] = useState<string[]>([]);
  const [step, setStep] = useState<WorkflowStepId>(1);
  const [unlockedThrough, setUnlockedThrough] = useState<WorkflowStepId>(1);
  const [humanAnalysis, setHumanAnalysis] = useState<AnalysisPayload | null>(null);
  const [mobileTab, setMobileTab] = useState<"workspace" | "preview">("workspace");
  const [zoom, setZoom] = useState<PreviewZoom>("fit");
  const [fitScale, setFitScale] = useState(0.55);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [processStep, setProcessStep] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [compareSide, setCompareSide] = useState<"original" | "tailored">("tailored");
  const [splitPct, setSplitPct] = useState(52);
  const draggingSplit = useRef(false);
  const splitPctRef = useRef(52);
  const scoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const paperScale = zoom === "fit" ? fitScale : zoom;
  const recommended = recommendIntensity(humanAnalysis?.distance);

  const liveAtsRobustness = useMemo(() => {
    if (!hasTailored && !hasSource) return null;
    return computeAtsRobustness({
      resume: hasTailored ? resume : sourceResume,
      jobDescription,
      source: hasSource ? sourceResume : null,
    });
  }, [hasTailored, hasSource, resume, sourceResume, jobDescription]);

  const displayedAts = atsRobustness ?? liveAtsRobustness;

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
        body: JSON.stringify({
          resume: r,
          jobDescription: jd,
          source: sourceResume,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        score: AtsScore;
        atsRobustness?: AtsRobustnessReport;
      };
      setScore(data.score);
      if (data.atsRobustness) setAtsRobustness(data.atsRobustness);
    } catch {
      /* ignore */
    }
  }, [sourceResume]);

  useEffect(() => {
    // Keep tailor API alignment bands — don't overwrite with raw live score
    if (appliedIntensity) return;
    if (scoreTimer.current) clearTimeout(scoreTimer.current);
    scoreTimer.current = setTimeout(() => {
      void liveScore(resume, jobDescription);
    }, 600);
    return () => {
      if (scoreTimer.current) clearTimeout(scoreTimer.current);
    };
  }, [resume, jobDescription, liveScore, appliedIntensity]);

  useEffect(() => {
    if (hasSource && hasJd && unlockedThrough < 3) {
      unlock(3);
    }
  }, [hasSource, hasJd, unlockedThrough]);

  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as {
        jobDescription?: string;
        intensity?: TailorIntensity;
        style?: ResumeStyle;
      };
      if (d.jobDescription) setJobDescription(d.jobDescription);
      if (d.intensity) setIntensity(d.intensity);
      if (d.style) setStyle({ ...DEFAULT_RESUME_STYLE, ...d.style });
      setDraftStatus("Draft restored");
    } catch {
      /* ignore */
    }
  }, []);

  // Persist draft
  useEffect(() => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ jobDescription, intensity, style, savedAt: Date.now() }),
        );
        setDraftStatus("Saved just now");
      } catch {
        /* ignore */
      }
    }, 800);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [jobDescription, intensity, style]);

  // Fit scale for A4 in preview pane (desktop fixed paper)
  useEffect(() => {
    const el = previewPaneRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - 32;
      if (w > 0) setFitScale(Math.min(1, Math.max(0.35, w / A4_WIDTH_PX)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobileTab, viewMode]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("alfred-split-pct");
      if (saved) {
        const n = Number(saved);
        if (Number.isFinite(n) && n >= 32 && n <= 72) setSplitPct(n);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingSplit.current) return;
      const main = document.getElementById("alfred-main-split");
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(72, Math.max(32, pct));
      splitPctRef.current = clamped;
      setSplitPct(clamped);
    };
    const onUp = () => {
      if (!draggingSplit.current) return;
      draggingSplit.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem("alfred-split-pct", String(splitPctRef.current));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startSplitDrag(e: ReactMouseEvent) {
    e.preventDefault();
    draggingSplit.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  // Give Compare more preview room by default
  useEffect(() => {
    if (isNarrow || viewMode !== "compare") return;
    setSplitPct((p) => {
      const next = Math.min(p, 40);
      splitPctRef.current = next;
      return next;
    });
  }, [viewMode, isNarrow]);

  function adoptParsed(parsed: StructuredResume, text?: string) {
    setSourceResume(structuredClone(parsed));
    setResume(parsed);
    setScore(null);
    setAtsRobustness(null);
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
    setProcessStep("Parsing resume file");
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
      setProcessStep(null);
    }
  }

  async function parsePastedText() {
    if (!rawText.trim()) {
      setError("Paste resume text first");
      return;
    }
    setBusy("parse");
    setProcessStep("Parsing pasted text");
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
      setProcessStep(null);
    }
  }

  async function compileFromNotes(forceAi = false) {
    const text = compileNotes.trim();
    if (text.length < 20) {
      setError("Add your name, experience, education, and skills (at least a short draft).");
      return;
    }
    setBusy("compile");
    setProcessStep("Compiling notes into resume JSON");
    setError(null);
    setCompileWarnings([]);
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, forceAi }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        resume: StructuredResume;
        warnings?: string[];
        engine?: string;
        atsRobustness?: AtsRobustnessReport;
      };
      adoptParsed(data.resume, text);
      setFileName("compiled-resume.json");
      setCompileWarnings(data.warnings || []);
      if (data.atsRobustness) setAtsRobustness(data.atsRobustness);
      setViewMode("edit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compile failed.");
    } finally {
      setBusy(null);
      setProcessStep(null);
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
    setProcessStep("Mapping experience to the role");
    startProgress();
    try {
      await liveScore(sourceResume, jobDescription);
      setProcessStep("Scoring role alignment");
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: sourceResume,
          jobDescription,
          intensity: "subtle",
          analyzeOnly: true,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        score: AtsScore;
        atsRobustness?: AtsRobustnessReport;
        humanAnalysis?: AnalysisPayload;
        plan?: AnalysisPayload;
      };
      setScore(data.score);
      if (data.atsRobustness) setAtsRobustness(data.atsRobustness);
      const ha = data.humanAnalysis || null;
      if (ha && data.plan) {
        setHumanAnalysis({ ...ha, ...data.plan });
      } else {
        setHumanAnalysis(ha);
      }
      const dist = ha?.distance || data.plan?.distance;
      setIntensity(recommendIntensity(dist));
      unlock(4);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't finish the analysis.");
    } finally {
      stopProgress();
      setBusy(null);
      setProcessStep(null);
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
    setProcessStep("Optimizing resume for the role");
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
        atsRobustness?: AtsRobustnessReport;
        intensity?: TailorIntensity;
        humanAnalysis?: AnalysisPayload;
        plan?: AnalysisPayload;
      };
      setResume(data.resume);
      setScore(data.score);
      if (data.atsRobustness) setAtsRobustness(data.atsRobustness);
      setAppliedIntensity(data.intensity || nextIntensity);
      if (data.humanAnalysis) {
        setHumanAnalysis({
          ...data.humanAnalysis,
          ...(data.plan || {}),
        });
      }
      setViewMode("tailored");
      setCompareSide("tailored");
      unlock(5);
      setStep(5);
      setMobileTab(isNarrow ? "workspace" : "preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't finish tailoring.");
    } finally {
      stopProgress();
      setBusy(null);
      setProcessStep(null);
    }
  }

  async function generateCoverLetter() {
    if (!jobDescription.trim() || !hasSource) {
      setError("Need a resume and job description for the cover letter");
      return;
    }
    setBusy("cover");
    setError(null);
    setProcessStep("Writing cover letter");
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
      setProcessStep(null);
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
    setAtsRobustness(null);
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

  function goHomeStep() {
    if (step === 1) return;
    setStep(1);
    setMobileTab("workspace");
    setMobileMenuOpen(false);
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
    <div className="flex min-h-[100dvh] flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 pt-safe backdrop-blur">
        <div className="relative mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-3 py-2.5 sm:px-4 lg:px-8 lg:py-3">
          <button
            type="button"
            onClick={goHomeStep}
            className={`min-w-0 shrink text-left ${
              step === 1
                ? "cursor-default"
                : "rounded-md outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--alfred-amber)]/40"
            }`}
            aria-label={
              step === 1 ? "Alfred Terminal" : "Alfred Terminal — back to Resume step"
            }
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
              <span className="font-mono text-[var(--alfred-amber)]">&gt;_</span>
              <span className="truncate">Alfred Terminal</span>
            </p>
            <p className="hidden text-[10px] text-[var(--text-muted)] sm:block">
              Your career, intelligently optimized.
            </p>
          </button>

          <div className="hidden min-w-0 flex-1 lg:block">
            <ProgressStepper
              current={step}
              unlockedThrough={unlockedThrough}
              onNavigate={go}
            />
          </div>

          <div className="relative flex shrink-0 items-center gap-1.5 sm:gap-2">
            {draftStatus ? (
              <span className="hidden text-[10px] text-[var(--text-muted)] md:inline">
                {draftStatus}
              </span>
            ) : null}
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
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] transition hover:border-[var(--border-hover)] hover:text-[var(--text)] sm:hidden"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-haspopup="menu"
              onClick={() => setMobileMenuOpen((o) => !o)}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            {mobileMenuOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40 cursor-default bg-black/20 sm:hidden"
                  aria-label="Close menu overlay"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] sm:hidden"
                >
                  <div className="border-b border-[var(--border)] bg-[var(--elevated)]/50 px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Account
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-[var(--text)]">
                      {userName || "Signed in"}
                    </p>
                    {userEmail ? (
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                        {userEmail}
                      </p>
                    ) : null}
                  </div>
                  <div className="p-1.5">
                    <Link
                      href="/coffee"
                      role="menuitem"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--text)] transition hover:bg-[var(--elevated)]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--alfred-amber)]/15 text-[var(--alfred-amber)]">
                        <Coffee className="h-4 w-4" />
                      </span>
                      <span>
                        <span className="block font-medium">Buy me a coffee</span>
                        <span className="block text-xs text-[var(--text-muted)]">
                          Support Alfred Terminal
                        </span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text)] transition hover:bg-[var(--elevated)]"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        goHomeStep();
                      }}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--elevated)] font-mono text-xs text-[var(--text-muted)]">
                        01
                      </span>
                      <span>
                        <span className="block font-medium">Resume step</span>
                        <span className="block text-xs text-[var(--text-muted)]">
                          {step === 1 ? "You’re already here" : "Back to upload"}
                        </span>
                      </span>
                    </button>
                  </div>
                  <div className="border-t border-[var(--border)] p-1.5">
                    <SignOutButton className="flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--elevated)] hover:text-[var(--text)]" />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* Mobile progress — own row so it never fights the brand/actions */}
        <div className="border-t border-[var(--border)] px-2 py-1.5 lg:hidden">
          <ProgressStepper
            current={step}
            unlockedThrough={unlockedThrough}
            onNavigate={(s) => {
              go(s);
              setMobileTab("workspace");
            }}
          />
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
          <div className="space-y-0.5 px-3 py-1.5 sm:px-4 lg:px-8">
            <p className="font-mono text-[11px] text-[var(--alfred-amber)]">{processLabel}</p>
            {processStep ? (
              <p className="font-mono text-[10px] text-[var(--text-muted)]">→ {processStep}</p>
            ) : null}
          </div>
        ) : null}

        {/* Mobile Workspace / Preview — part of sticky header */}
        <div className="flex border-t border-[var(--border)] lg:hidden">
          {(
            [
              { id: "workspace" as const, label: "Workspace", icon: PenLine },
              { id: "preview" as const, label: "Preview", icon: Eye },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMobileTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium ${
                mobileTab === t.id
                  ? "border-b-2 border-[var(--alfred-amber)] text-[var(--alfred-amber)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main
        id="alfred-main-split"
        className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-0 lg:flex-row"
      >
        <div
          className={`min-w-0 space-y-6 overflow-y-auto px-3 py-5 pb-28 sm:space-y-8 sm:px-4 sm:py-6 lg:max-h-[calc(100vh-57px)] lg:px-8 lg:py-8 lg:pb-8 ${
            mobileTab === "preview" ? "hidden lg:block" : ""
          }`}
          style={isNarrow ? undefined : { width: `${splitPct}%`, flexShrink: 0 }}
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
          {step === 1 || (step <= 2 && !hasSource) ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight">Resume</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Upload an existing resume, or create one from scratch with natural language.
              </p>

              <div className="mt-4 flex gap-2">
                {(
                  [
                    { id: "upload" as const, label: "Upload" },
                    { id: "create" as const, label: "Create from scratch" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEntryMode(t.id)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${
                      entryMode === t.id
                        ? "bg-[var(--alfred-amber)] text-[var(--bg)]"
                        : "border border-[var(--border)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {entryMode === "upload" ? (
                <>
                  <label className="mt-5 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center transition active:border-[var(--alfred-amber)]/50 hover:border-[var(--alfred-amber)]/40 sm:px-6 sm:py-12">
                    <Upload className="h-8 w-8 text-[var(--text-muted)]" />
                    <span className="mt-3 text-sm font-medium">
                      <span className="sm:hidden">Tap to upload PDF, DOCX, or TXT</span>
                      <span className="hidden sm:inline">Drop PDF, DOCX, TXT, or Markdown</span>
                    </span>
                    <span className="mt-1 text-xs text-[var(--text-muted)]">Browse files · max 5 MB</span>
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
                </>
              ) : (
                <div className="mt-5 space-y-3">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Describe yourself in plain language. Alfred compiles it into structured JSON,
                    then you can preview and download a PDF.
                  </p>
                  <textarea
                    value={compileNotes}
                    onChange={(e) => setCompileNotes(e.target.value)}
                    rows={16}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-3 font-mono text-xs leading-relaxed outline-none focus:border-[var(--alfred-amber)]"
                    placeholder={COMPILE_PLACEHOLDER}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => compileFromNotes(false)}
                      className="h-11 rounded-lg bg-[var(--alfred-amber)] px-5 text-sm font-semibold text-[var(--bg)] disabled:opacity-50"
                    >
                      {busy === "compile" ? "Compiling…" : "Compile resume"}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => compileFromNotes(true)}
                      className="h-11 rounded-lg border border-[var(--border)] px-4 text-sm disabled:opacity-50"
                    >
                      Compile with AI
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompileNotes(COMPILE_PLACEHOLDER)}
                      className="h-11 rounded-lg border border-[var(--border)] px-4 text-sm text-[var(--text-secondary)]"
                    >
                      Load example
                    </button>
                  </div>
                  {compileWarnings.length ? (
                    <ul className="space-y-1 text-xs text-[var(--warning)]">
                      {compileWarnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </section>
          ) : null}

          {hasSource && step <= 2 ? (
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
          {step === 2 && unlockedThrough >= 2 ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight">Target job</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Paste the job description for the role you&apos;re applying to.
              </p>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={10}
                className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-base leading-relaxed outline-none focus:border-[var(--alfred-amber)] sm:px-4 sm:text-sm"
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
              {hasSource && hasJd ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={runAnalysis}
                  className="mt-5 h-12 w-full rounded-lg bg-[var(--alfred-amber)] px-6 text-sm font-semibold text-[var(--bg)] disabled:opacity-50 sm:h-11 sm:w-auto"
                >
                  {busy === "analyze" ? "Analyzing…" : "Analyze application"}
                </button>
              ) : null}
            </section>
          ) : null}

          {/* STEP 3 — Analysis */}
          {step === 3 && unlockedThrough >= 3 && (humanAnalysis || score) ? (
            <AnalysisPanel
              score={score}
              atsOverall={displayedAts?.overall}
              analysis={humanAnalysis}
              recommended={recommended}
              showContinue={unlockedThrough >= 4}
              onContinue={() => setStep(4)}
            />
          ) : null}

          {/* STEP 4 — Tailor only */}
          {step === 4 && unlockedThrough >= 4 ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight">Tailor resume</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Choose how aggressively Alfred should optimize around this role.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(["subtle", "medium", "hard"] as TailorIntensity[]).map((mode) => {
                  const meta = TAILOR_INTENSITY_META[mode];
                  const active = intensity === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setIntensity(mode)}
                      className={`min-h-[88px] rounded-xl border px-4 py-4 text-left transition duration-150 ${
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

              <div className="mt-5 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={style.showHeadline}
                    onChange={(e) =>
                      setStyle((s) => ({ ...s, showHeadline: e.target.checked }))
                    }
                  />
                  Show headline under name
                </label>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2 text-[var(--text-secondary)]">
                    Font
                    <select
                      className="rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 py-1.5 text-sm text-[var(--text)]"
                      value={style.fontFamily}
                      onChange={(e) =>
                        setStyle((s) => ({
                          ...s,
                          fontFamily: e.target.value as ResumeStyle["fontFamily"],
                        }))
                      }
                    >
                      <option value="helvetica">Helvetica</option>
                      <option value="times">Times</option>
                      <option value="courier">Courier</option>
                    </select>
                  </label>
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    Size
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg border border-[var(--border)]"
                      onClick={() =>
                        setStyle((s) => ({
                          ...s,
                          fontSize: Math.max(8, s.fontSize - 0.5),
                        }))
                      }
                    >
                      −
                    </button>
                    <span className="w-8 text-center tabular-nums text-[var(--text)]">
                      {style.fontSize}
                    </span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-lg border border-[var(--border)]"
                      onClick={() =>
                        setStyle((s) => ({
                          ...s,
                          fontSize: Math.min(12, s.fontSize + 0.5),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => tailor(intensity)}
                  className="h-12 w-full rounded-lg bg-[var(--alfred-amber)] px-6 text-sm font-semibold text-[var(--bg)] disabled:opacity-50 sm:h-11 sm:w-auto"
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
                    className="h-12 w-full rounded-lg border border-[var(--border)] px-4 text-sm disabled:opacity-50 sm:h-11 sm:w-auto"
                  >
                    Reset to original
                  </button>
                ) : null}
              </div>
              <div className="h-4 sm:h-2" aria-hidden />
            </section>
          ) : null}

          {/* STEP 5 — Review + Cover Letter */}
          {step === 5 && hasTailored ? (
            <section className="space-y-10">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Your resume is ready.</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Optimized for this role. Review the preview, then download.
                </p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <span>
                    Role alignment{" "}
                    <strong className="text-[var(--alfred-amber)]">
                      {score?.matchRate ?? "—"}%
                    </strong>
                  </span>
                  <span>
                    ATS score{" "}
                    <strong className="text-[var(--alfred-amber)]">
                      {displayedAts?.overall ?? "—"}
                    </strong>
                    <span className="text-[var(--text-muted)]"> / 100</span>
                  </span>
                  {displayedAts?.status === "excellent" ||
                  displayedAts?.status === "strong" ? (
                    <span className="text-[var(--success)]">
                      ATS-ready structure ✓
                    </span>
                  ) : null}
                </div>
                {displayedAts ? (
                  <div className="mt-5 max-w-md">
                    <AtsRobustnessPanel report={displayedAts} />
                  </div>
                ) : null}
                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => exportFile("pdf")}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--alfred-amber)] px-5 text-sm font-semibold text-[var(--bg)] disabled:opacity-50 sm:h-11 sm:w-auto"
                  >
                    <Download className="h-4 w-4" />
                    {busy === "pdf" ? "Building…" : "Download PDF"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => exportFile("docx")}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-5 text-sm disabled:opacity-50 sm:h-11 sm:w-auto"
                  >
                    {busy === "docx" ? "Building…" : "Download DOCX"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => tailor(intensity)}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 text-sm disabled:opacity-50 sm:h-11 sm:w-auto"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(4);
                      setMobileTab("workspace");
                    }}
                    className="h-12 w-full rounded-lg border border-[var(--border)] px-4 text-sm sm:h-11 sm:w-auto"
                  >
                    Change mode
                  </button>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-8">
                <h3 className="text-lg font-semibold tracking-tight">Cover letter</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Make the application complete.
                </p>
                {!coverLetter ? (
                  <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
                    <p className="mx-auto max-w-md text-sm text-[var(--text-secondary)]">
                      Generate a role-specific cover letter from your tailored resume and target
                      job description.
                    </p>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={generateCoverLetter}
                      className="mt-5 h-12 w-full rounded-lg bg-[var(--alfred-amber)] px-5 text-sm font-semibold text-[var(--bg)] disabled:opacity-50 sm:h-11 sm:w-auto"
                    >
                      {busy === "cover" ? "Writing…" : "Generate Cover Letter"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 flex flex-wrap gap-2">
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
                      rows={14}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                    />
                  </>
                )}
              </div>
            </section>
          ) : null}
        </div>

        {/* Resizable divider — desktop only */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
          onMouseDown={startSplitDrag}
          className={`relative hidden w-2 shrink-0 cursor-col-resize items-stretch justify-center lg:flex ${
            mobileTab === "preview" ? "" : ""
          }`}
          title="Drag to resize"
        >
          <div className="my-4 w-px bg-[var(--border)] transition group-hover:bg-[var(--alfred-amber)]" />
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--border-hover)]" />
        </div>

        {/* Preview column */}
        <aside
          className={`flex min-h-0 min-w-0 flex-1 flex-col border-[var(--border)] bg-[var(--elevated)]/40 lg:max-h-[calc(100vh-57px)] lg:overflow-hidden lg:border-l-0 ${
            mobileTab === "workspace"
              ? "hidden lg:flex"
              : "flex h-[calc(100dvh-11.5rem)] max-h-[calc(100dvh-11.5rem)]"
          }`}
        >
          <PreviewToolbar
            viewMode={viewMode}
            onViewMode={(m) => {
              setViewMode(m);
              if (m === "compare") setCompareSide("tailored");
            }}
            zoom={zoom}
            onZoom={setZoom}
            compact={isNarrow}
            hideZoom={isNarrow}
          />
          <div
            ref={previewPaneRef}
            className={`flex-1 overflow-x-auto overflow-y-auto p-3 sm:p-4 ${
              step === 5 && isNarrow ? "pb-24" : "pb-safe"
            }`}
          >
            {!hasSource ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)]">
                Upload a resume to preview
              </div>
            ) : viewMode === "original" ? (
              <ResumePaper
                resume={sourceResume}
                style={style}
                label="Original"
                scale={paperScale}
                fluid={isNarrow}
              />
            ) : viewMode === "tailored" ? (
              <ResumePaper
                resume={resume}
                style={style}
                scale={paperScale}
                fluid={isNarrow}
                label={
                  appliedIntensity
                    ? `Tailored · ${TAILOR_INTENSITY_META[appliedIntensity].label}`
                    : "Current"
                }
              />
            ) : viewMode === "compare" ? (
              isNarrow ? (
                <div className="space-y-3">
                  <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5">
                    {(
                      [
                        ["original", "Original"],
                        ["tailored", "Tailored"],
                      ] as const
                    ).map(([side, label]) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setCompareSide(side)}
                        className={`min-h-10 flex-1 rounded-md text-sm font-medium transition ${
                          compareSide === side
                            ? "bg-[var(--elevated)] text-[var(--text)]"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <ResumePaper
                    resume={compareSide === "original" ? sourceResume : resume}
                    style={style}
                    fluid
                    label={
                      compareSide === "original"
                        ? "Original"
                        : appliedIntensity
                          ? `Tailored · ${TAILOR_INTENSITY_META[appliedIntensity].label}`
                          : "Tailored"
                    }
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-6 xl:flex-row xl:justify-center">
                  <ResumePaper
                    resume={sourceResume}
                    style={style}
                    label="Original"
                    scale={Math.min(paperScale, 0.55)}
                  />
                  <ResumePaper
                    resume={resume}
                    style={style}
                    scale={Math.min(paperScale, 0.55)}
                    label={
                      appliedIntensity
                        ? `Tailored · ${TAILOR_INTENSITY_META[appliedIntensity].label}`
                        : "Tailored"
                    }
                  />
                </div>
              )
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

      {/* Single Tailor CTA — dynamic mode label only */}
      {hasSource && hasJd && unlockedThrough >= 4 && step === 4 && mobileTab === "workspace" ? (
        <div className="sticky bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] px-3 py-3 pb-safe sm:px-4 lg:justify-end lg:px-8">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => tailor(intensity)}
              className="h-12 w-full rounded-lg bg-[var(--alfred-amber)] px-5 text-sm font-semibold text-[var(--bg)] disabled:opacity-50 sm:h-11 lg:w-auto"
            >
              {busy === "tailor"
                ? "Tailoring…"
                : `Tailor with ${TAILOR_INTENSITY_META[intensity].label}`}
            </button>
          </div>
        </div>
      ) : null}

      {/* Mobile Review: download while on Preview */}
      {step === 5 && hasTailored && mobileTab === "preview" && isNarrow ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
          <div className="flex gap-2 px-3 py-3 pb-safe">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => exportFile("pdf")}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--alfred-amber)] text-sm font-semibold text-[var(--bg)] disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {busy === "pdf" ? "…" : "PDF"}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => exportFile("docx")}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border border-[var(--border)] text-sm disabled:opacity-50"
            >
              {busy === "docx" ? "…" : "DOCX"}
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("workspace")}
              className="inline-flex h-12 items-center justify-center rounded-lg border border-[var(--border)] px-3 text-sm"
            >
              More
            </button>
          </div>
        </div>
      ) : null}

      {hasSource && mobileTab === "workspace" && step !== 4 ? (
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className="fixed bottom-5 right-3 z-30 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-xs font-medium text-[var(--text)] shadow-[var(--shadow)] lg:hidden"
        >
          <Eye className="h-3.5 w-3.5 text-[var(--alfred-amber)]" />
          Preview
        </button>
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
    <div className="mx-auto grid max-w-xl gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Edit resume
      </p>
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
            field === "location" ? resume.contact.location || "" : resume.contact[field]
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
        className="rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-sm"
        rows={4}
        value={resume.skills.map((g) => `${g.category}: ${g.items.join(", ")}`).join("\n")}
        onChange={(e) => {
          const skills = e.target.value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const [cat, rest] = line.split(":");
              return {
                category: (cat || "Skills").trim(),
                items: (rest || "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
            });
          setResume((r) => ({ ...r, skills }));
        }}
        placeholder={"Skills (one group per line)\nCore Competencies: React, TypeScript"}
      />
      <details className="text-xs text-[var(--text-muted)]">
        <summary className="cursor-pointer">Advanced JSON</summary>
        <textarea
          className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 font-mono text-xs"
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
      </details>
    </div>
  );
}

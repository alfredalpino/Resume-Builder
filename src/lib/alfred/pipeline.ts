import {
  analyzeJobDescription,
  detectResumeDomain,
  type JdAnalysis,
} from "@/lib/nlp";
import {
  centerResumeForJd,
  pivotDistance,
  type TailorIntensity,
  TAILOR_INTENSITY_META,
} from "@/lib/center";
import { resumeToPlainText, type StructuredResume } from "@/lib/schema";
import {
  buildOptimizationPlan,
  planToHumanAnalysis,
  type OptimizationPlan,
} from "@/lib/resume/optimizer-plan";
import { validateTailoredResume } from "@/lib/resume/validate";
import { polishResume } from "@/lib/resume/polish";
import { injectJdCoverage } from "@/lib/resume/inject-jd-coverage";
import { aiWriterAvailable, writeResumeWithClaude } from "@/lib/resume/writer-claude";
import { jevPostValidate, jevPreAnalyze } from "@/lib/jev/client";
import { getEntitlements, type Entitlements } from "@/lib/billing/entitlements";

export type AlfredPipelineResult = {
  resume: StructuredResume;
  thinking: string[];
  analysis: JdAnalysis;
  intensity: TailorIntensity;
  headlineParts: string[];
  plan: OptimizationPlan;
  humanAnalysis: ReturnType<typeof planToHumanAnalysis>;
  writer: "deterministic" | "ai";
  jev: { pre: boolean; post: boolean; notes: string[] };
  entitlements: Entitlements;
};

function extractThemes(jd: string, analysis: JdAnalysis): string[] {
  const themes: string[] = [];
  if (/end.to.end|own things|ownership/i.test(jd)) themes.push("end-to-end ownership");
  if (/agent|langchain|langgraph|llm|ai-native/i.test(jd)) themes.push("AI / agent systems");
  if (/ui\/?ux|user-facing|frontend|next\.js|react/i.test(jd)) themes.push("user-facing UI");
  if (/workflow|automation/i.test(jd)) themes.push("workflow automation");
  if (/ship|production|deploy/i.test(jd)) themes.push("shipping to production");
  return themes.slice(0, 6);
}

/**
 * Alfred Terminal pipeline: plan → (Claude | deterministic) → validate → optional Jev post.
 * Pass analyzeOnly to build plan + humanAnalysis without rewriting the resume.
 */
export async function runAlfredPipeline(
  resume: StructuredResume,
  jobDescription: string,
  intensity: TailorIntensity = "medium",
  userEmail?: string | null,
  options?: { analyzeOnly?: boolean },
): Promise<AlfredPipelineResult> {
  const entitlements = getEntitlements(userEmail);
  const effectiveIntensity = intensity;

  const analysis = analyzeJobDescription(jobDescription);
  const sourceText = resumeToPlainText(resume);
  const resumeDomain = detectResumeDomain(sourceText);
  const distance = pivotDistance(resumeDomain, analysis.domain);
  const themes = extractThemes(jobDescription, analysis);
  const evidenced = analysis.tools.filter((t) => {
    try {
      return new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
        sourceText,
      );
    } catch {
      return sourceText.toLowerCase().includes(t.toLowerCase());
    }
  });
  const missing = analysis.tools.filter((t) => !evidenced.includes(t));

  const plan = buildOptimizationPlan({
    resume,
    analysis,
    distance,
    intensity: effectiveIntensity,
    themes,
    evidenced,
    missing,
    resumeDomain,
  });

  const thinking: string[] = [
    ...analysis.thinking,
    `Intensity: ${effectiveIntensity} (${TAILOR_INTENSITY_META[effectiveIntensity].label}).`,
    `Plan tone: ${plan.tone}.`,
  ];

  const humanAnalysis = planToHumanAnalysis(plan);
  const headlineParts = resume.headline
    ? resume.headline.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean)
    : [];

  if (options?.analyzeOnly) {
    thinking.push("Mode: analyze only (no rewrite).");
    return {
      resume,
      thinking,
      analysis,
      intensity: effectiveIntensity,
      headlineParts,
      plan,
      humanAnalysis,
      writer: "deterministic",
      jev: { pre: false, post: false, notes: [] },
      entitlements,
    };
  }

  const pre = await jevPreAnalyze({ resume, jobDescription, plan });
  thinking.push(...pre.confidenceNotes.map((n) => `Alfred: ${n}`));

  let writer: "deterministic" | "ai" = "deterministic";
  let tailored: StructuredResume;

  const useAi = entitlements.aiWriter && aiWriterAvailable();

  if (useAi) {
    const aiOut = await writeResumeWithClaude(resume, plan, jobDescription);
    if (aiOut) {
      tailored = aiOut;
      writer = "ai";
      thinking.push("Writer: AI (OpenRouter/Anthropic).");
    } else {
      const det = centerResumeForJd(resume, jobDescription, analysis, effectiveIntensity);
      tailored = det.resume;
      thinking.push(...det.thinking, "Writer: deterministic (AI unavailable).");
    }
  } else {
    const det = centerResumeForJd(resume, jobDescription, analysis, effectiveIntensity);
    tailored = det.resume;
    thinking.push(...det.thinking, "Writer: deterministic.");
  }

  let validation = validateTailoredResume(tailored, resume, plan);
  tailored = validation.resume;
  if (!validation.ok) {
    thinking.push(`Polish notes: ${validation.issues.join("; ")}`);
  }

  // Force JD keyword/tool coverage so alignment actually moves with intensity
  tailored = injectJdCoverage(tailored, analysis, effectiveIntensity);
  thinking.push(`JD coverage inject (${effectiveIntensity}).`);

  const post = await jevPostValidate({
    source: resume,
    tailored,
    jobDescription,
  });
  thinking.push(...post.confidenceNotes.map((n) => `Alfred: ${n}`));

  const outHeadline = tailored.headline
    ? tailored.headline.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    resume: polishResume(tailored),
    thinking,
    analysis,
    intensity: effectiveIntensity,
    headlineParts: outHeadline,
    plan,
    humanAnalysis,
    writer,
    jev: {
      pre: pre.available,
      post: post.available,
      notes: [...pre.confidenceNotes, ...post.confidenceNotes],
    },
    entitlements,
  };
}

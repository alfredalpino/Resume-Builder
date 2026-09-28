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
import { claudeWriterAvailable, writeResumeWithClaude } from "@/lib/resume/writer-claude";
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
  writer: "deterministic" | "claude";
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
 */
export async function runAlfredPipeline(
  resume: StructuredResume,
  jobDescription: string,
  intensity: TailorIntensity = "medium",
  userEmail?: string | null,
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

  const pre = await jevPreAnalyze({ resume, jobDescription, plan });
  thinking.push(...pre.confidenceNotes.map((n) => `Alfred: ${n}`));

  let writer: "deterministic" | "claude" = "deterministic";
  let tailored: StructuredResume;

  // Claude is free for everyone when server key is configured
  const useClaude =
    entitlements.claudeWriter &&
    claudeWriterAvailable() &&
    (effectiveIntensity === "hard" || effectiveIntensity === "medium");

  if (useClaude) {
    const claudeOut = await writeResumeWithClaude(resume, plan, jobDescription);
    if (claudeOut) {
      tailored = claudeOut;
      writer = "claude";
      thinking.push("Writer: Claude.");
    } else {
      const det = centerResumeForJd(resume, jobDescription, analysis, effectiveIntensity);
      tailored = det.resume;
      thinking.push(...det.thinking, "Writer: deterministic (Claude unavailable).");
    }
  } else {
    const det = centerResumeForJd(resume, jobDescription, analysis, effectiveIntensity);
    tailored = det.resume;
    thinking.push(...det.thinking, "Writer: deterministic.");
  }

  let validation = validateTailoredResume(tailored, resume, plan);
  tailored = validation.resume;
  if (!validation.ok) {
    thinking.push(`Validation issues: ${validation.issues.join("; ")}`);
    // One deterministic regenerate pass
    const retry = centerResumeForJd(resume, jobDescription, analysis, effectiveIntensity);
    validation = validateTailoredResume(retry.resume, resume, plan);
    tailored = validation.resume;
    thinking.push("Regenerated after validation fail.");
  }

  const post = await jevPostValidate({
    source: resume,
    tailored,
    jobDescription,
  });
  thinking.push(...post.confidenceNotes.map((n) => `Alfred: ${n}`));
  if (post.available && !post.claimIntegrityOk) {
    const safe = centerResumeForJd(resume, jobDescription, analysis, "medium");
    tailored = polishResume(safe.resume);
    thinking.push("Claim integrity failed — fell back to Medium deterministic.");
  }

  const humanAnalysis = planToHumanAnalysis(plan);
  const headlineParts = tailored.headline
    ? tailored.headline.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    resume: polishResume(tailored),
    thinking,
    analysis,
    intensity: effectiveIntensity,
    headlineParts,
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

import { analyzeJobDescription, type JdAnalysis } from "@/lib/nlp";
import {
  centerResumeForJd,
  type TailorIntensity,
  TAILOR_INTENSITY_META,
} from "@/lib/center";
import type { StructuredResume } from "@/lib/schema";

export type { TailorIntensity };
export { TAILOR_INTENSITY_META };

/**
 * Smart Thinking tailor — vision-centering rewrite toward the JD.
 * Intensity: subtle | medium | hard.
 * Never invents employers, degrees, or unearned tech skills.
 */
export function tailorResumeSmart(
  resume: StructuredResume,
  jobDescription: string,
  analysis?: JdAnalysis,
  intensity: TailorIntensity = "medium",
): {
  resume: StructuredResume;
  thinking: string[];
  analysis: JdAnalysis;
  intensity: TailorIntensity;
  headlineParts: string[];
} {
  const result = centerResumeForJd(resume, jobDescription, analysis, intensity);
  return {
    resume: result.resume,
    thinking: result.thinking,
    analysis: result.analysis,
    intensity: result.intensity,
    headlineParts: result.headlineParts,
  };
}

export function tailorResumeLocally(
  resume: StructuredResume,
  jobDescription: string,
  intensity: TailorIntensity = "medium",
): StructuredResume {
  return tailorResumeSmart(resume, jobDescription, undefined, intensity).resume;
}

export { analyzeJobDescription };

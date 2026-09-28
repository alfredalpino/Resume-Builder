/**
 * Deterministic writer entry — currently delegates to centerResumeForJd polish path.
 * Kept as a named module for the Alfred pipeline architecture.
 */
import { centerResumeForJd, type TailorIntensity } from "@/lib/center";
import type { JdAnalysis } from "@/lib/nlp";
import type { StructuredResume } from "@/lib/schema";
import { polishResume } from "@/lib/resume/polish";

export function writeResumeDeterministic(
  resume: StructuredResume,
  jobDescription: string,
  intensity: TailorIntensity,
  analysis?: JdAnalysis,
): StructuredResume {
  const result = centerResumeForJd(resume, jobDescription, analysis, intensity);
  return polishResume(result.resume);
}

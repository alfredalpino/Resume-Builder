import { analyzeJobDescription, type JdAnalysis } from "@/lib/nlp";
import { centerResumeForJd } from "@/lib/center";
import type { StructuredResume } from "@/lib/schema";

/**
 * Smart Thinking tailor — vision-centering rewrite toward the JD.
 * Never invents employers, degrees, or unearned tech skills.
 */
export function tailorResumeSmart(
  resume: StructuredResume,
  jobDescription: string,
  analysis?: JdAnalysis,
): { resume: StructuredResume; thinking: string[]; analysis: JdAnalysis } {
  const result = centerResumeForJd(resume, jobDescription, analysis);
  return {
    resume: result.resume,
    thinking: result.thinking,
    analysis: result.analysis,
  };
}

export function tailorResumeLocally(
  resume: StructuredResume,
  jobDescription: string,
): StructuredResume {
  return tailorResumeSmart(resume, jobDescription).resume;
}

export { analyzeJobDescription };

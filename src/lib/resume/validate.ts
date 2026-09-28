import type { StructuredResume } from "@/lib/schema";
import type { OptimizationPlan } from "@/lib/resume/optimizer-plan";
import { polishResume } from "@/lib/resume/polish";

export type ValidationResult = {
  ok: boolean;
  issues: string[];
  resume: StructuredResume;
};

/**
 * Light polish only — unrestricted mode does not strip tech claims or forbid skills.
 */
export function validateTailoredResume(
  tailored: StructuredResume,
  _source: StructuredResume,
  _plan: OptimizationPlan,
): ValidationResult {
  const issues: string[] = [];
  let polished = polishResume(tailored);

  if (polished.summary && !/^[A-Z]/.test(polished.summary.trim())) {
    issues.push("Summary capitalized");
    const s = polished.summary.trim();
    polished = {
      ...polished,
      summary: s.charAt(0).toUpperCase() + s.slice(1),
    };
  }

  const outText = [
    polished.summary,
    ...polished.skills.flatMap((g) => g.items),
    ...polished.experience.flatMap((j) => j.bullets),
  ].join(" ");

  if (/transferable strengths|tools already used|aspiring |deliberate pivot/i.test(outText)) {
    issues.push("Coach-speak language detected");
  }

  return {
    ok: !issues.some((i) => i.includes("Coach-speak")),
    issues,
    resume: polishResume(polished),
  };
}

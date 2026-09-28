import type { StructuredResume } from "@/lib/schema";
import { resumeToPlainText } from "@/lib/schema";
import { normalize } from "@/lib/nlp";
import type { OptimizationPlan } from "@/lib/resume/optimizer-plan";
import { polishResume } from "@/lib/resume/polish";

export type ValidationResult = {
  ok: boolean;
  issues: string[];
  resume: StructuredResume;
};

const TECH_CLAIM =
  /\b(typescript|javascript|python|react|next\.?js|node\.?js|kubernetes|docker|aws|langchain|langgraph|golang|rust)\b/gi;

/** Reject invented tech claims not on source resume and enforce polish. */
export function validateTailoredResume(
  tailored: StructuredResume,
  source: StructuredResume,
  plan: OptimizationPlan,
): ValidationResult {
  const issues: string[] = [];
  const polished = polishResume(tailored);
  const sourceN = normalize(resumeToPlainText(source));
  const outText = resumeToPlainText(polished);

  if (polished.summary && !/^[A-Z]/.test(polished.summary.trim())) {
    issues.push("Summary must start with a capital letter");
  }

  const claimed = outText.match(TECH_CLAIM) || [];
  for (const raw of claimed) {
    const t = raw.toLowerCase();
    if (!sourceN.includes(normalize(t))) {
      issues.push(`Unsupported tech claim: ${raw}`);
    }
  }

  for (const forbid of plan.forbidClaims.slice(0, 10)) {
    const fn = normalize(forbid);
    if (fn.length < 4) continue;
    // Only flag if tailored newly asserts it as a skill line and source lacks it
    if (
      !sourceN.includes(fn) &&
      polished.skills.some((g) => g.items.some((i) => normalize(i) === fn))
    ) {
      issues.push(`Forbidden skill asserted: ${forbid}`);
    }
  }

  if (/transferable strengths|tools already used|aspiring |deliberate pivot/i.test(outText)) {
    issues.push("Coach-speak language detected");
  }

  // Auto-strip unsupported tech from skills if found
  if (issues.some((i) => i.startsWith("Unsupported tech"))) {
    polished.skills = polished.skills.map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        const techs = item.match(TECH_CLAIM) || [];
        return techs.every((t) => sourceN.includes(normalize(t)));
      }),
    }));
  }

  const stillBad = issues.filter(
    (i) =>
      i.includes("capital letter") ||
      i.includes("Coach-speak") ||
      i.includes("Forbidden skill"),
  );

  return {
    ok: stillBad.length === 0,
    issues,
    resume: polishResume(polished),
  };
}

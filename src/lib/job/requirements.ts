import type { JdAnalysis } from "@/lib/nlp";

export type JdRequirement = {
  id: string;
  type: "skill" | "experience" | "education" | "other";
  requirement: string;
  importance: "required" | "preferred";
};

/** Deterministic JD requirement extraction (Jev upgrades statuses later). */
export function extractRequirements(analysis: JdAnalysis): JdRequirement[] {
  const out: JdRequirement[] = [];
  let i = 0;
  for (const requirement of analysis.mustHave.slice(0, 16)) {
    out.push({
      id: `req_${++i}`,
      type: "skill",
      requirement,
      importance: "required",
    });
  }
  for (const requirement of analysis.niceToHave.slice(0, 8)) {
    out.push({
      id: `req_${++i}`,
      type: "skill",
      requirement,
      importance: "preferred",
    });
  }
  return out;
}

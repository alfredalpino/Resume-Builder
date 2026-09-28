import { z } from "zod";
import type { JdAnalysis, ResumeDomain } from "@/lib/nlp";
import type { PivotDistance, TailorIntensity } from "@/lib/center";
import type { StructuredResume } from "@/lib/schema";
import { resumeToPlainText } from "@/lib/schema";
import { normalize, termInText } from "@/lib/nlp";

export const OptimizationPlanSchema = z.object({
  targetRole: z.string(),
  distance: z.enum(["same", "adjacent", "hard"]),
  intensity: z.enum(["subtle", "medium", "hard"]),
  tone: z.enum(["preserve", "ops_professional", "eng_adjacent", "hard_pivot"]),
  priorities: z.array(z.string()).max(12),
  sectionsToModify: z.array(z.string()),
  sectionsToPreserve: z.array(z.string()),
  emphasize: z.array(z.string()),
  forbidClaims: z.array(z.string()),
  evidencedTools: z.array(z.string()),
  missingTools: z.array(z.string()),
  themes: z.array(z.string()),
  requirementStatuses: z.array(
    z.object({
      requirement: z.string(),
      status: z.enum(["SUPPORTED", "PARTIALLY_SUPPORTED", "NOT_SUPPORTED", "UNCLEAR"]),
    }),
  ),
});

export type OptimizationPlan = z.infer<typeof OptimizationPlanSchema>;

export function buildOptimizationPlan(input: {
  resume: StructuredResume;
  analysis: JdAnalysis;
  distance: PivotDistance;
  intensity: TailorIntensity;
  themes: string[];
  evidenced: string[];
  missing: string[];
  resumeDomain: ResumeDomain;
}): OptimizationPlan {
  const {
    resume,
    analysis,
    distance,
    intensity,
    themes,
    evidenced,
    missing,
    resumeDomain,
  } = input;
  const text = resumeToPlainText(resume);
  const n = normalize(text);

  const requirementStatuses = analysis.mustHave.slice(0, 16).map((requirement) => {
    const hit = termInText(requirement, n);
    const partial =
      !hit &&
      requirement.split(/\s+/).some((w) => w.length > 3 && n.includes(normalize(w)));
    return {
      requirement,
      status: (hit
        ? "SUPPORTED"
        : partial
          ? "PARTIALLY_SUPPORTED"
          : "NOT_SUPPORTED") as OptimizationPlan["requirementStatuses"][number]["status"],
    };
  });

  const tone =
    intensity === "subtle"
      ? "preserve"
      : distance === "hard"
        ? "hard_pivot"
        : resumeDomain === "support" || resumeDomain === "ops"
          ? "ops_professional"
          : "eng_adjacent";

  const priorities: string[] = [];
  if (distance === "hard") {
    priorities.push("Reframe support operations language toward product / engineering adjacency");
    priorities.push("Lead with requirements clarification, SLA reliability, and cross-team coordination");
    priorities.push("Never invent programming languages, frameworks, or metrics");
  } else {
    priorities.push("Promote evidenced JD tools and terminology");
    priorities.push("Reorder skills and bullets for ATS overlap");
  }
  for (const t of themes.slice(0, 4)) priorities.push(`Align language toward: ${t}`);
  for (const e of evidenced.slice(0, 4)) priorities.push(`Emphasize evidenced tool: ${e}`);

  const forbidClaims = [
    ...missing.slice(0, 12),
    ...requirementStatuses
      .filter((r) => r.status === "NOT_SUPPORTED")
      .map((r) => r.requirement)
      .slice(0, 8),
  ];

  return OptimizationPlanSchema.parse({
    targetRole: analysis.titleHints[0] || analysis.domain,
    distance,
    intensity,
    tone,
    priorities: [...new Set(priorities)].slice(0, 12),
    sectionsToModify:
      intensity === "subtle"
        ? ["Skills"]
        : ["Professional Summary", "Skills", "Experience", "Projects"],
    sectionsToPreserve: ["Education", "Contact"],
    emphasize: [
      ...evidenced.slice(0, 6),
      ...requirementStatuses
        .filter((r) => r.status === "SUPPORTED")
        .map((r) => r.requirement)
        .slice(0, 6),
    ],
    forbidClaims: [...new Set(forbidClaims)],
    evidencedTools: evidenced,
    missingTools: missing,
    themes,
    requirementStatuses,
  });
}

export function planToHumanAnalysis(plan: OptimizationPlan): {
  strongMatches: string[];
  needsAttention: string[];
  opportunities: string[];
} {
  return {
    strongMatches: plan.requirementStatuses
      .filter((r) => r.status === "SUPPORTED")
      .map((r) => r.requirement)
      .slice(0, 8),
    needsAttention: plan.requirementStatuses
      .filter((r) => r.status === "NOT_SUPPORTED" || r.status === "PARTIALLY_SUPPORTED")
      .map((r) =>
        r.status === "PARTIALLY_SUPPORTED"
          ? `${r.requirement} (limited evidence)`
          : `${r.requirement} not found on resume`,
      )
      .slice(0, 8),
    opportunities: plan.priorities.slice(0, 6),
  };
}

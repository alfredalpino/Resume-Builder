/**
 * Jev / TypeSafe decision client — no-op when TYPESAFE_API_KEY is absent.
 * Jev returns Choice / Score / Noul only — never prose.
 */
import type { OptimizationPlan } from "@/lib/resume/optimizer-plan";
import type { StructuredResume } from "@/lib/schema";
import { resumeToPlainText } from "@/lib/schema";

export const JEV_ANALYSIS_VERSION = "v1";

export function jevAvailable(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY?.trim());
}

export type JevPreAnalysis = {
  available: boolean;
  roleCategory?: string;
  overallRelevance?: string;
  hasMajorGap?: number;
  confidenceNotes: string[];
};

export type JevPostValidation = {
  available: boolean;
  claimIntegrityOk: boolean;
  jdAligned: boolean;
  confidenceNotes: string[];
};

/** Batched pre-generation decisions. Returns unavailable stub without key. */
export async function jevPreAnalyze(input: {
  resume: StructuredResume;
  jobDescription: string;
  plan: OptimizationPlan;
}): Promise<JevPreAnalysis> {
  if (!jevAvailable()) {
    return { available: false, confidenceNotes: ["Jev unavailable — using deterministic plan"] };
  }

  const key = process.env.TYPESAFE_API_KEY!.trim();
  const state = {
    resume: resumeToPlainText(input.resume).slice(0, 12000),
    job_description: input.jobDescription.slice(0, 8000),
    plan_priorities: input.plan.priorities,
  };

  const questions = {
    role_category: {
      type: "choice",
      instructions: "Which role category best describes the target job?",
      criteria: {
        software_engineering: "Software engineering or application development",
        ai_ml: "AI, ML, agents, or LLM product work",
        support_ops: "Customer support, BPO, or operations",
        other: "None of the above",
      },
    },
    overall_relevance: {
      type: "score",
      instructions: "How strongly does the candidate resume align with the target job?",
      criteria: ["Very weak", "Weak", "Limited", "Moderate", "Good", "Strong", "Very strong"],
    },
    has_major_skill_gap: {
      type: "noul",
      instructions: "Does the candidate appear to have a major qualification gap for this role?",
    },
  };

  try {
    const res = await fetch("https://api.typesafe.ai/v1/query", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ state, questions }),
    });
    if (!res.ok) {
      return {
        available: false,
        confidenceNotes: [`Jev HTTP ${res.status} — falling back to rules`],
      };
    }
    const data = (await res.json()) as {
      answers?: Record<
        string,
        { choice?: string; score?: string; noul?: number; confidence?: number }
      >;
    };
    const a = data.answers || {};
    return {
      available: true,
      roleCategory: a.role_category?.choice,
      overallRelevance: a.overall_relevance?.score,
      hasMajorGap: a.has_major_skill_gap?.noul,
      confidenceNotes: [
        a.role_category?.confidence != null
          ? `role confidence ${a.role_category.confidence}`
          : "role answered",
      ],
    };
  } catch (err) {
    return {
      available: false,
      confidenceNotes: [`Jev error: ${err instanceof Error ? err.message : "unknown"}`],
    };
  }
}

export async function jevPostValidate(input: {
  source: StructuredResume;
  tailored: StructuredResume;
  jobDescription: string;
}): Promise<JevPostValidation> {
  if (!jevAvailable()) {
    return {
      available: false,
      claimIntegrityOk: true,
      jdAligned: true,
      confidenceNotes: ["Jev post-check skipped"],
    };
  }

  const key = process.env.TYPESAFE_API_KEY!.trim();
  try {
    const res = await fetch("https://api.typesafe.ai/v1/query", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        state: {
          source: resumeToPlainText(input.source).slice(0, 8000),
          tailored: resumeToPlainText(input.tailored).slice(0, 8000),
          job_description: input.jobDescription.slice(0, 4000),
        },
        questions: {
          claim_integrity: {
            type: "noul",
            instructions:
              "Does the tailored resume contain material claims unsupported by the source resume?",
          },
          jd_aligned: {
            type: "noul",
            instructions:
              "Does the tailored resume meaningfully address important requirements of the JD?",
          },
        },
      }),
    });
    if (!res.ok) {
      return {
        available: false,
        claimIntegrityOk: true,
        jdAligned: true,
        confidenceNotes: [`Jev post HTTP ${res.status}`],
      };
    }
    const data = (await res.json()) as {
      answers?: Record<string, { noul?: number }>;
    };
    const integrityFail = (data.answers?.claim_integrity?.noul ?? 0) > 0.55;
    const aligned = (data.answers?.jd_aligned?.noul ?? 1) > 0.45;
    return {
      available: true,
      claimIntegrityOk: !integrityFail,
      jdAligned: aligned,
      confidenceNotes: ["Jev post-validation complete"],
    };
  } catch {
    return {
      available: false,
      claimIntegrityOk: true,
      jdAligned: true,
      confidenceNotes: ["Jev post-check error — skipped"],
    };
  }
}

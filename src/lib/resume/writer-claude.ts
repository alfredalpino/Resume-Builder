/**
 * Pro writer — Anthropic Claude when ANTHROPIC_API_KEY is set.
 * Falls back to null so pipeline uses deterministic writer.
 */
import type { StructuredResume } from "@/lib/schema";
import { StructuredResumeSchema } from "@/lib/schema";
import type { OptimizationPlan } from "@/lib/resume/optimizer-plan";
import { polishResume } from "@/lib/resume/polish";

export function claudeWriterAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function writeResumeWithClaude(
  source: StructuredResume,
  plan: OptimizationPlan,
  jobDescription: string,
): Promise<StructuredResume | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;

  const system = `You are Alfred Terminal's resume writer. Rewrite the candidate resume toward the JD using ONLY facts in the source resume and the optimization plan. Never invent employers, degrees, metrics, certifications, or technologies. Return ONLY valid JSON matching the StructuredResume schema.`;

  const user = JSON.stringify({
    plan,
    jobDescription: jobDescription.slice(0, 6000),
    sourceResume: source,
    rules: [
      "Summary must start with a capital letter",
      "Hard pivots: use Core Competencies + Applications skill categories",
      "Forbid claims listed in plan.forbidClaims",
      "No phrases: Aspiring, deliberate pivot, Tools Already Used, Transferable Strengths",
    ],
  });

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.2,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      console.error("Claude writer HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.find((c) => c.type === "text")?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = StructuredResumeSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parsed.success) {
      console.error("Claude resume schema fail", parsed.error.message);
      return null;
    }
    return polishResume(parsed.data);
  } catch (err) {
    console.error("Claude writer error", err);
    return null;
  }
}

export async function writeCoverLetterWithClaude(
  resume: StructuredResume,
  plan: OptimizationPlan,
  jobDescription: string,
  strategy: Record<string, string>,
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 1500,
        temperature: 0.3,
        system:
          "Write a professional cover letter. Use only evidenced facts. No invented stack or metrics. Return plain text only.",
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              strategy,
              plan: { targetRole: plan.targetRole, emphasize: plan.emphasize, forbidClaims: plan.forbidClaims },
              resume: {
                name: resume.contact.fullName,
                email: resume.contact.email,
                phone: resume.contact.phone,
                summary: resume.summary,
                experience: resume.experience.slice(0, 2),
              },
              jobDescription: jobDescription.slice(0, 4000),
            }),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    return data.content?.find((c) => c.type === "text")?.text?.trim() || null;
  } catch {
    return null;
  }
}

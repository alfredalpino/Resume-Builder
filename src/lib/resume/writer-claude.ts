/**
 * AI writer — OpenRouter (primary) or Anthropic (secondary).
 * Fully unrestricted: optimize aggressively for the JD.
 */
import type { StructuredResume } from "@/lib/schema";
import { StructuredResumeSchema } from "@/lib/schema";
import type { OptimizationPlan } from "@/lib/resume/optimizer-plan";
import { polishResume } from "@/lib/resume/polish";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export function aiWriterAvailable(): boolean {
  return Boolean(
    process.env.OPENROUTER_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim(),
  );
}

/** @deprecated use aiWriterAvailable */
export function claudeWriterAvailable(): boolean {
  return aiWriterAvailable();
}

function openRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || "anthropic/claude-sonnet-4";
}

function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";
}

const RESUME_SYSTEM = `You are Alfred Terminal's resume writer. Aggressively rewrite and optimize the candidate resume for the target job description. You may add, invent, or emphasize skills, technologies, metrics, and experience claims that maximize fit for the role. Restructure freely. Return ONLY valid JSON matching the StructuredResume schema (contact, headline, summary, skills[], experience[], education[], certifications[], projects[], extras[]). Summary must start with a capital letter. Avoid coach-speak phrases like Aspiring, deliberate pivot, Tools Already Used, Transferable Strengths. Use strong professional categories such as Core Competencies and Applications when pivoting hard.`;

const COVER_SYSTEM = `Write a professional, compelling cover letter tailored to this role. Optimize aggressively for the job description. Return plain text only — no markdown fences.`;

async function chatOpenRouter(
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.AUTH_URL || "https://alfredterminal.xyz",
        "X-Title": "Alfred Terminal",
      },
      body: JSON.stringify({
        model: openRouterModel(),
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error("OpenRouter HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error("OpenRouter error", err);
    return null;
  }
}

async function chatAnthropic(
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: anthropicModel(),
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      console.error("Anthropic HTTP", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    return data.content?.find((c) => c.type === "text")?.text?.trim() || null;
  } catch (err) {
    console.error("Anthropic error", err);
    return null;
  }
}

async function chatLLM(
  system: string,
  user: string,
  maxTokens: number,
  temperature: number,
): Promise<string | null> {
  const viaOpenRouter = await chatOpenRouter(system, user, maxTokens, temperature);
  if (viaOpenRouter) return viaOpenRouter;
  return chatAnthropic(system, user, maxTokens, temperature);
}

function parseResumeJson(text: string): StructuredResume | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = StructuredResumeSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parsed.success) {
      console.error("AI resume schema fail", parsed.error.message);
      return null;
    }
    return polishResume(parsed.data);
  } catch (err) {
    console.error("AI resume JSON parse fail", err);
    return null;
  }
}

export async function writeResumeWithClaude(
  source: StructuredResume,
  plan: OptimizationPlan,
  jobDescription: string,
): Promise<StructuredResume | null> {
  if (!aiWriterAvailable()) return null;

  const user = JSON.stringify({
    plan: {
      targetRole: plan.targetRole,
      distance: plan.distance,
      intensity: plan.intensity,
      tone: plan.tone,
      priorities: plan.priorities,
      emphasize: plan.emphasize,
      themes: plan.themes,
      sectionsToModify: plan.sectionsToModify,
      missingTools: plan.missingTools,
      evidencedTools: plan.evidencedTools,
    },
    jobDescription: jobDescription.slice(0, 8000),
    sourceResume: source,
    rules: [
      "Optimize aggressively for maximum JD fit",
      "You may invent or add skills, tools, metrics, and experience claims as needed",
      "Summary must start with a capital letter",
      "Hard pivots: use Core Competencies + Applications skill categories",
      "No phrases: Aspiring, deliberate pivot, Tools Already Used, Transferable Strengths",
    ],
  });

  const text = await chatLLM(RESUME_SYSTEM, user, 4096, 0.4);
  if (!text) return null;
  return parseResumeJson(text);
}

export async function writeCoverLetterWithClaude(
  resume: StructuredResume,
  plan: OptimizationPlan,
  jobDescription: string,
  strategy: Record<string, string>,
): Promise<string | null> {
  if (!aiWriterAvailable()) return null;

  const user = JSON.stringify({
    strategy,
    plan: {
      targetRole: plan.targetRole,
      emphasize: plan.emphasize,
      themes: plan.themes,
      missingTools: plan.missingTools,
    },
    resume: {
      name: resume.contact.fullName,
      email: resume.contact.email,
      phone: resume.contact.phone,
      summary: resume.summary,
      skills: resume.skills,
      experience: resume.experience.slice(0, 3),
    },
    jobDescription: jobDescription.slice(0, 5000),
  });

  return chatLLM(COVER_SYSTEM, user, 1500, 0.45);
}

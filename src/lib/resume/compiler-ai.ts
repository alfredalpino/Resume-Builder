/**
 * AI-assisted path for the NL Resume Compiler.
 * Uses OpenRouter / Anthropic to map freeform prose → StructuredResume JSON.
 */
import {
  aiWriterAvailable,
} from "@/lib/resume/writer-claude";
import {
  completenessScore,
  compileDeterministic,
  type CompileResult,
} from "@/lib/resume/compiler";
import { polishResume } from "@/lib/resume/polish";
import { StructuredResumeSchema, type StructuredResume } from "@/lib/schema";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM = `You are Alfred Terminal's resume compiler.
Convert the user's natural-language notes into ONE JSON object matching StructuredResume:

{
  "contact": { "fullName", "email", "phone", "location?", "links": [{ "label", "url" }] },
  "headline": string,
  "summary": string,
  "skills": [{ "category", "items": string[] }],
  "experience": [{ "company", "title", "location?", "start", "end", "bullets": string[] }],
  "education": [{ "school", "degree", "dates", "details?" }],
  "certifications": string[],
  "awards": string[],
  "projects": [{ "name", "url?", "bullets": string[] }],
  "extras": string[]
}

Rules:
- Invent nothing the user did not imply. Prefer empty arrays over guesses.
- Expand terse notes into professional bullet points without inventing employers or degrees.
- Dates: keep user wording (e.g. "2022 – Present").
- Links must be absolute https:// URLs when present.
- Summary: 2–4 sentences, start with a capital letter.
- Return ONLY valid JSON. No markdown fences.`;

function openRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || "anthropic/claude-sonnet-4";
}

function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";
}

function extractJson(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Model did not return JSON");
  }
}

async function chatOpenRouter(user: string): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.AUTH_URL || "https://alfredterminal.xyz",
        "X-Title": "Alfred Terminal Compiler",
      },
      body: JSON.stringify({
        model: openRouterModel(),
        max_tokens: 4096,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function chatAnthropic(user: string): Promise<string | null> {
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
        max_tokens: 4096,
        temperature: 0.2,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
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

function mergePreferFilled(
  base: StructuredResume,
  ai: StructuredResume,
): StructuredResume {
  const out = structuredClone(base);
  if (ai.contact.fullName && ai.contact.fullName !== "Your Name") {
    out.contact.fullName = ai.contact.fullName;
  }
  if (ai.contact.email) out.contact.email = ai.contact.email;
  if (ai.contact.phone) out.contact.phone = ai.contact.phone;
  if (ai.contact.location) out.contact.location = ai.contact.location;
  if (ai.contact.links?.length) {
    const urls = new Set(out.contact.links.map((l) => l.url));
    for (const l of ai.contact.links) {
      if (!urls.has(l.url)) out.contact.links.push(l);
    }
  }
  if (ai.headline) out.headline = ai.headline;
  if (ai.summary && ai.summary.length > (out.summary?.length || 0)) {
    out.summary = ai.summary;
  }
  if (ai.skills.length && ai.skills.some((g) => g.items.length)) out.skills = ai.skills;
  if (ai.experience.length) out.experience = ai.experience;
  if (ai.education.length) out.education = ai.education;
  if (ai.projects.length) out.projects = ai.projects;
  if (ai.certifications.length) out.certifications = ai.certifications;
  if (ai.awards?.length) out.awards = ai.awards;
  if (ai.extras?.length) out.extras = ai.extras;
  return out;
}

/**
 * Compile NL → StructuredResume.
 * Deterministic first; AI when freeform/incomplete and keys available.
 */
export async function compileResumeFromNaturalLanguage(
  text: string,
  opts?: { forceAi?: boolean },
): Promise<CompileResult> {
  const det = compileDeterministic(text);
  const score = completenessScore(det.resume);
  const needsAi =
    opts?.forceAi ||
    score < 70 ||
    det.warnings.some((w) => /AI compile|freeform|not detected/i.test(w));

  if (!needsAi || !aiWriterAvailable()) {
    return det;
  }

  const raw =
    (await chatOpenRouter(text)) || (await chatAnthropic(text));
  if (!raw) {
    return {
      ...det,
      warnings: [
        ...det.warnings,
        "AI compile unavailable — used deterministic parser.",
      ],
    };
  }

  try {
    const json = extractJson(raw);
    const parsed = StructuredResumeSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ...det,
        warnings: [...det.warnings, "AI JSON failed validation — used deterministic."],
      };
    }
    const merged = polishResume(mergePreferFilled(det.resume, parsed.data));
    const final = StructuredResumeSchema.parse(merged);
    return {
      resume: final,
      engine: score >= 50 ? "hybrid" : "ai",
      warnings: det.warnings.filter((w) => !/AI compile recommended/i.test(w)),
      sectionsFound: det.sectionsFound,
    };
  } catch {
    return {
      ...det,
      warnings: [...det.warnings, "AI compile failed — used deterministic parser."],
    };
  }
}

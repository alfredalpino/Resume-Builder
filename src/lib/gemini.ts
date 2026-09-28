import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_KEY_HEADER } from "@/lib/constants";
import { StructuredResumeSchema, type StructuredResume } from "@/lib/schema";
import { STRUCTURE_PROMPT, TAILOR_PROMPT } from "@/lib/prompts";
import { GEMINI_MODELS, type GeminiModel } from "@/lib/gemini-models";

export { GEMINI_KEY_HEADER, GEMINI_MODELS };
export type { GeminiModel };

export function getGeminiKey(req: Request): string | null {
  const key = req.headers.get(GEMINI_KEY_HEADER)?.trim();
  return key || null;
}

function getModel(apiKey: string, model: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model did not return valid JSON");
  }
}

async function withModelFallback<T>(
  apiKey: string,
  preferred: string | undefined,
  run: (modelName: string) => Promise<T>,
): Promise<T> {
  const order = [
    preferred,
    ...GEMINI_MODELS.filter((m) => m !== preferred),
  ].filter(Boolean) as string[];

  let lastError: Error | null = null;
  for (const modelName of order) {
    try {
      return await run(modelName);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message;
      // Try next model on not-found / unavailable / quota
      if (/404|not found|no longer available|503|unavailable|quota|429|resource.exhausted/i.test(msg)) {
        continue;
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("All Gemini models failed");
}

export async function validateGeminiKey(
  apiKey: string,
  preferredModel?: string,
): Promise<{ ok: boolean; model: string }> {
  return withModelFallback(apiKey, preferredModel, async (modelName) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Reply with OK");
    const text = result.response.text();
    if (!text) throw new Error("Empty response");
    return { ok: true, model: modelName };
  });
}

export async function structureResumeWithGemini(
  apiKey: string,
  rawText: string,
  links: { label: string; url: string }[],
  preferredModel?: string,
): Promise<StructuredResume> {
  return withModelFallback(apiKey, preferredModel, async (modelName) => {
    const model = getModel(apiKey, modelName);
    const prompt = `${STRUCTURE_PROMPT}

KNOWN_LINKS (preserve these URLs exactly; assign sensible labels):
${JSON.stringify(links, null, 2)}

RESUME_TEXT:
"""
${rawText.slice(0, 60000)}
"""`;
    const result = await model.generateContent(prompt);
    return StructuredResumeSchema.parse(extractJson(result.response.text()));
  });
}

export async function tailorResumeWithGemini(
  apiKey: string,
  resume: StructuredResume,
  jobDescription: string,
  preferredModel?: string,
): Promise<StructuredResume> {
  return withModelFallback(apiKey, preferredModel, async (modelName) => {
    const model = getModel(apiKey, modelName);
    const prompt = `${TAILOR_PROMPT}

JOB_DESCRIPTION:
"""
${jobDescription.slice(0, 40000)}
"""

SOURCE_RESUME_JSON:
${JSON.stringify(resume, null, 2)}`;
    const result = await model.generateContent(prompt);
    return StructuredResumeSchema.parse(extractJson(result.response.text()));
  });
}

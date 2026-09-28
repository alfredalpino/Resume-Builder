import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_KEY_HEADER } from "@/lib/constants";
import { StructuredResumeSchema, type StructuredResume } from "@/lib/schema";
import { STRUCTURE_PROMPT, TAILOR_PROMPT } from "@/lib/prompts";

export { GEMINI_KEY_HEADER };

export function getGeminiKey(req: Request): string | null {
  const key = req.headers.get(GEMINI_KEY_HEADER)?.trim();
  return key || null;
}

const DEFAULT_MODEL = "gemini-3.8-flash";

function getModel(apiKey: string, model = DEFAULT_MODEL) {
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

export async function validateGeminiKey(apiKey: string): Promise<boolean> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
  const result = await model.generateContent("Reply with OK");
  const text = result.response.text();
  return Boolean(text && text.length > 0);
}

export async function structureResumeWithGemini(
  apiKey: string,
  rawText: string,
  links: { label: string; url: string }[],
): Promise<StructuredResume> {
  const model = getModel(apiKey);
  const prompt = `${STRUCTURE_PROMPT}

KNOWN_LINKS (preserve these URLs exactly; assign sensible labels):
${JSON.stringify(links, null, 2)}

RESUME_TEXT:
"""
${rawText.slice(0, 60000)}
"""`;

  const result = await model.generateContent(prompt);
  const parsed = extractJson(result.response.text());
  return StructuredResumeSchema.parse(parsed);
}

export async function tailorResumeWithGemini(
  apiKey: string,
  resume: StructuredResume,
  jobDescription: string,
): Promise<StructuredResume> {
  const model = getModel(apiKey);
  const prompt = `${TAILOR_PROMPT}

JOB_DESCRIPTION:
"""
${jobDescription.slice(0, 40000)}
"""

SOURCE_RESUME_JSON:
${JSON.stringify(resume, null, 2)}`;

  const result = await model.generateContent(prompt);
  const parsed = extractJson(result.response.text());
  return StructuredResumeSchema.parse(parsed);
}

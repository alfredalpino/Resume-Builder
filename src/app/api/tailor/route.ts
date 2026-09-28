import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { scoreResume } from "@/lib/ats-score";
import { getGeminiKey, tailorResumeWithGemini } from "@/lib/gemini";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const key = getGeminiKey(req);
  if (!key) return apiError("Missing Gemini API key. Paste your key in Setup.");

  try {
    const body = await req.json();
    const jobDescription = String(body.jobDescription || "").trim();
    if (!jobDescription) return apiError("Job description is required");
    if (jobDescription.length < 40) {
      return apiError("Job description looks too short");
    }

    const resume = StructuredResumeSchema.parse(body.resume);
    const tailored = await tailorResumeWithGemini(key, resume, jobDescription);

    // Preserve source links if model dropped them
    const urls = new Set(tailored.contact.links.map((l) => l.url));
    for (const link of resume.contact.links) {
      if (!urls.has(link.url)) tailored.contact.links.push(link);
    }

    const score = scoreResume(tailored, jobDescription);

    return NextResponse.json({
      resume: tailored,
      score,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tailoring failed";
    if (/api key|permission|401|403/i.test(message)) {
      return apiError("Gemini rejected the API key or request", 401);
    }
    if (/quota|429|rate/i.test(message)) {
      return apiError("Gemini quota exceeded. Try again later.", 429);
    }
    return apiError(message, 400);
  }
}

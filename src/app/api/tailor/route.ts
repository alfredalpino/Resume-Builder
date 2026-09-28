import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { scoreResume } from "@/lib/ats-score";
import { getGeminiKey, tailorResumeWithGemini } from "@/lib/gemini";
import { tailorResumeLocally } from "@/lib/local-tailor";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const jobDescription = String(body.jobDescription || "").trim();
    if (!jobDescription) return apiError("Job description is required");
    if (jobDescription.length < 40) {
      return apiError("Job description looks too short");
    }

    const mode = body.mode === "gemini" ? "gemini" : "local";
    const preferredModel =
      typeof body.model === "string" ? body.model : undefined;
    const resume = StructuredResumeSchema.parse(body.resume);

    let tailored;
    let engine: "local" | "gemini" = "local";

    if (mode === "gemini") {
      const key = getGeminiKey(req);
      if (!key) {
        return apiError(
          "Gemini mode needs an API key. Switch to Local ATS (no key) or paste a key.",
        );
      }
      try {
        tailored = await tailorResumeWithGemini(
          key,
          resume,
          jobDescription,
          preferredModel,
        );
        engine = "gemini";
      } catch (err) {
        const message = err instanceof Error ? err.message : "Gemini failed";
        // Automatic fallback to local so the product always works
        tailored = tailorResumeLocally(resume, jobDescription);
        engine = "local";
        const score = scoreResume(tailored, jobDescription);
        return NextResponse.json({
          resume: tailored,
          score,
          engine,
          warning: `Gemini unavailable (${message.slice(0, 120)}). Used Local ATS instead.`,
        });
      }
    } else {
      tailored = tailorResumeLocally(resume, jobDescription);
    }

    const urls = new Set(tailored.contact.links.map((l) => l.url));
    for (const link of resume.contact.links) {
      if (!urls.has(link.url)) tailored.contact.links.push(link);
    }

    const score = scoreResume(tailored, jobDescription);

    return NextResponse.json({
      resume: tailored,
      score,
      engine,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tailoring failed";
    return apiError(message, 400);
  }
}

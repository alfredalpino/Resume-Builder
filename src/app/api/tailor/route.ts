import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { analyzeJobDescription, scoreResume } from "@/lib/ats-score";
import { tailorResumeSmart, type TailorIntensity } from "@/lib/local-tailor";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

const INTENSITIES = new Set<TailorIntensity>(["subtle", "medium", "hard"]);

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

    const rawIntensity = String(body.intensity || "medium").toLowerCase();
    const intensity: TailorIntensity = INTENSITIES.has(rawIntensity as TailorIntensity)
      ? (rawIntensity as TailorIntensity)
      : "medium";

    const source = StructuredResumeSchema.parse(body.resume);
    const analysis = analyzeJobDescription(jobDescription);
    const smart = tailorResumeSmart(source, jobDescription, analysis, intensity);
    const tailored = smart.resume;

    const urls = new Set(tailored.contact.links.map((l) => l.url));
    for (const link of source.contact.links) {
      if (!urls.has(link.url)) tailored.contact.links.push(link);
    }

    const score = scoreResume(tailored, jobDescription, analysis);

    return NextResponse.json({
      resume: tailored,
      score: {
        ...score,
        thinking: [...smart.thinking, ...(score.thinking || [])],
      },
      engine: "smart",
      intensity,
      analysis: {
        titleHints: analysis.titleHints,
        mustHave: analysis.mustHave,
        tools: analysis.tools,
        keywords: analysis.keywords,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tailoring failed";
    return apiError(message, 400);
  }
}

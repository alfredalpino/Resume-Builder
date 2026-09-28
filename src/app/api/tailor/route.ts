import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { analyzeJobDescription, scoreResume } from "@/lib/ats-score";
import { tailorResumeSmart } from "@/lib/local-tailor";
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

    const source = StructuredResumeSchema.parse(body.resume);
    const analysis = analyzeJobDescription(jobDescription);
    const smart = tailorResumeSmart(source, jobDescription, analysis);
    const tailored = smart.resume;

    // Preserve links
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

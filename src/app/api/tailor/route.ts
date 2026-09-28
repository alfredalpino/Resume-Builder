import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { apiError, requireSession } from "@/lib/api";
import { scoreResume } from "@/lib/ats-score";
import { runAlfredPipeline } from "@/lib/alfred/pipeline";
import type { TailorIntensity } from "@/lib/local-tailor";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

const INTENSITIES = new Set<TailorIntensity>(["subtle", "medium", "hard"]);

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const session = await auth();
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
    const result = await runAlfredPipeline(
      source,
      jobDescription,
      intensity,
      session?.user?.email,
    );
    const tailored = result.resume;

    const urls = new Set(tailored.contact.links.map((l) => l.url));
    for (const link of source.contact.links) {
      if (!urls.has(link.url)) tailored.contact.links.push(link);
    }

    const score = scoreResume(tailored, jobDescription, result.analysis);

    return NextResponse.json({
      resume: tailored,
      score: {
        ...score,
        thinking: score.thinking || [],
      },
      engine: "alfred",
      writer: result.writer,
      intensity: result.intensity,
      headlineParts: result.headlineParts,
      humanAnalysis: result.humanAnalysis,
      entitlements: result.entitlements,
      analysis: {
        titleHints: result.analysis.titleHints,
        mustHave: result.analysis.mustHave,
        tools: result.analysis.tools,
        keywords: result.analysis.keywords,
        companyHints: result.analysis.companyHints,
        salaryHints: result.analysis.salaryHints,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tailoring failed";
    return apiError(message, 400);
  }
}

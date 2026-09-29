import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { computeAtsRobustness } from "@/lib/ats-robustness";
import { scoreResume } from "@/lib/ats-score";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const jobDescription = String(body.jobDescription || "");
    const resume = StructuredResumeSchema.parse(body.resume);
    const source = body.source
      ? StructuredResumeSchema.safeParse(body.source)
      : null;
    const score = scoreResume(resume, jobDescription);
    const atsRobustness = computeAtsRobustness({
      resume,
      jobDescription,
      source: source?.success ? source.data : null,
    });
    return NextResponse.json({ score, atsRobustness });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";
    return apiError(message, 400);
  }
}

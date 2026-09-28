import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
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
    const score = scoreResume(resume, jobDescription);
    return NextResponse.json({ score });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";
    return apiError(message, 400);
  }
}

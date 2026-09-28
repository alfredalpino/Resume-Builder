import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { buildCoverLetter } from "@/lib/cover-letter";
import type { TailorIntensity } from "@/lib/center";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

const INTENSITIES = new Set<TailorIntensity>(["subtle", "medium", "hard"]);

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const jobDescription = String(body.jobDescription || "").trim();
    if (!jobDescription || jobDescription.length < 40) {
      return apiError("Job description is required");
    }
    const resume = StructuredResumeSchema.parse(body.resume);
    const rawIntensity = String(body.intensity || "medium").toLowerCase();
    const intensity: TailorIntensity = INTENSITIES.has(rawIntensity as TailorIntensity)
      ? (rawIntensity as TailorIntensity)
      : "medium";

    const { letter } = buildCoverLetter(resume, jobDescription, intensity);
    return NextResponse.json({ letter, intensity });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cover letter failed";
    return apiError(message, 400);
  }
}

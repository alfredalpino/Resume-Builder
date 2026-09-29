import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { validatePdfRoundTrip } from "@/lib/resume/roundtrip";
import { StructuredResumeSchema } from "@/lib/schema";
import { DEFAULT_RESUME_STYLE, ResumeStyleSchema } from "@/lib/style";

export const runtime = "nodejs";

/** PDF export → re-parse → field coverage report (ATS parseability proof). */
export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const resume = StructuredResumeSchema.parse(body.resume);
    const style = ResumeStyleSchema.catch(DEFAULT_RESUME_STYLE).parse(
      body.style ?? DEFAULT_RESUME_STYLE,
    );
    const report = await validatePdfRoundTrip(resume, style);
    return NextResponse.json({ report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Round-trip validation failed";
    return apiError(message, 400);
  }
}

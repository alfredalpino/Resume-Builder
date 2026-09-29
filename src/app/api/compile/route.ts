import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { compileResumeFromNaturalLanguage } from "@/lib/resume/compiler-ai";
import { COMPILE_PLACEHOLDER } from "@/lib/resume/compiler";
import { computeAtsRobustness } from "@/lib/ats-robustness";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const text = String(body.text || "").trim();
    const forceAi = Boolean(body.forceAi);
    if (text.length < 20) {
      return apiError(
        "Add more detail (name, experience, education, skills). Example notes are available in the editor.",
      );
    }
    if (text.length > 40_000) {
      return apiError("Notes are too long (max ~40k characters)");
    }

    const result = await compileResumeFromNaturalLanguage(text, { forceAi });
    const atsRobustness = computeAtsRobustness({
      resume: result.resume,
      source: result.resume,
    });

    return NextResponse.json({
      resume: result.resume,
      engine: result.engine,
      warnings: result.warnings,
      sectionsFound: result.sectionsFound,
      atsRobustness,
      placeholder: COMPILE_PLACEHOLDER,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compile failed";
    return apiError(message, 400);
  }
}

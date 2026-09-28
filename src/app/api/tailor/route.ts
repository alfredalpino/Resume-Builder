import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { analyzeJobDescription, scoreResume } from "@/lib/ats-score";
import { getGeminiKey, tailorResumeWithGemini } from "@/lib/gemini";
import { tailorResumeSmart } from "@/lib/local-tailor";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

function scrubCorruption(resume: ReturnType<typeof StructuredResumeSchema.parse>) {
  const strip = (t: string) =>
    t
      .replace(/\s*Core strengths aligned to this role include[^.]*\.?/gi, "")
      .replace(/,?\s*applying\s+[A-Z][^.]{0,60}\./gi, ".")
      .replace(/\s{2,}/g, " ")
      .trim();
  return {
    ...resume,
    summary: strip(resume.summary),
    experience: resume.experience.map((j) => ({
      ...j,
      bullets: j.bullets.map(strip).filter(Boolean),
    })),
    skills: resume.skills
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) =>
            !/^(not|help|fast|customers|all|know|do|care|it)$/i.test(item.trim()),
        ),
      }))
      .filter((g) => g.items.length > 0),
  };
}

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

    // Smart Thinking is the locked default engine — cannot be disabled.
    // Optional Gemini may refine AFTER smart analysis, then we re-scrub.
    const wantGemini = body.mode === "gemini";
    const preferredModel =
      typeof body.model === "string" ? body.model : undefined;
    const source = StructuredResumeSchema.parse(body.resume);
    const analysis = analyzeJobDescription(jobDescription);

    const smart = tailorResumeSmart(source, jobDescription, analysis);
    let tailored = smart.resume;
    let engine: "smart" | "gemini+smart" = "smart";
    let warning: string | undefined;
    const thinking = [...smart.thinking];

    if (wantGemini) {
      const key = getGeminiKey(req);
      if (!key) {
        warning =
          "Gemini requested but no key provided — used Smart Thinking only.";
      } else {
        try {
          const ai = await tailorResumeWithGemini(
            key,
            tailored,
            jobDescription,
            preferredModel,
          );
          tailored = scrubCorruption(ai);
          // Never let AI drop links
          const urls = new Set(tailored.contact.links.map((l) => l.url));
          for (const link of source.contact.links) {
            if (!urls.has(link.url)) tailored.contact.links.push(link);
          }
          engine = "gemini+smart";
          thinking.push(
            "Optional Gemini refine applied, then Smart Thinking scrub removed any keyword spam.",
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Gemini failed";
          warning = `Gemini unavailable (${message.slice(0, 100)}). Smart Thinking result kept.`;
          thinking.push(warning);
        }
      }
    }

    const score = scoreResume(tailored, jobDescription, analysis);

    return NextResponse.json({
      resume: tailored,
      score: { ...score, thinking: [...thinking, ...(score.thinking || [])] },
      engine,
      analysis: {
        titleHints: analysis.titleHints,
        mustHave: analysis.mustHave,
        tools: analysis.tools,
        keywords: analysis.keywords,
      },
      warning,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tailoring failed";
    return apiError(message, 400);
  }
}

/**
 * Inject JD keywords/tools into the tailored resume so role alignment
 * actually moves with Subtle / Balanced / Aggressive intensity.
 */
import type { JdAnalysis } from "@/lib/nlp";
import { normalize, termInText } from "@/lib/nlp";
import type { TailorIntensity } from "@/lib/center";
import type { StructuredResume } from "@/lib/schema";
import { resumeToPlainText } from "@/lib/schema";
import { capitalizeSentence } from "@/lib/resume/polish";

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of terms) {
    const n = normalize(t);
    if (!n || n.length < 2 || seen.has(n)) continue;
    seen.add(n);
    out.push(t.trim());
  }
  return out;
}

function takeMissing(resume: StructuredResume, terms: string[], limit: number): string[] {
  const text = normalize(resumeToPlainText(resume));
  return uniqueTerms(terms)
    .filter((t) => !termInText(t, text))
    .slice(0, limit);
}

function mergeSkillGroup(
  resume: StructuredResume,
  category: string,
  items: string[],
): StructuredResume {
  if (!items.length) return resume;
  const skills = [...resume.skills];
  const idx = skills.findIndex((g) => normalize(g.category) === normalize(category));
  if (idx >= 0) {
    const existing = new Set(skills[idx].items.map((i) => normalize(i)));
    const merged = [
      ...skills[idx].items,
      ...items.filter((i) => !existing.has(normalize(i))),
    ];
    skills[idx] = { ...skills[idx], items: merged };
  } else {
    skills.unshift({ category, items });
  }
  return { ...resume, skills };
}

function weaveSummary(summary: string, terms: string[], intensity: TailorIntensity): string {
  if (!terms.length) return summary;
  const base = summary.trim() || "Professional with a track record of delivering results.";
  const chunk =
    intensity === "hard"
      ? `Hands-on with ${terms.slice(0, 8).join(", ")}. Built and shipped work that maps directly to this role.`
      : intensity === "medium"
        ? `Experience spanning ${terms.slice(0, 5).join(", ")}, with a focus on owning outcomes end to end.`
        : `Familiar with ${terms.slice(0, 3).join(", ")} in day-to-day delivery.`;
  if (normalize(base).includes(normalize(terms[0]))) return capitalizeSentence(base);
  return capitalizeSentence(`${base.replace(/\.\s*$/, "")}. ${chunk}`);
}

function enrichBullets(
  resume: StructuredResume,
  terms: string[],
  maxJobs: number,
): StructuredResume {
  if (!terms.length) return resume;
  const experience = resume.experience.map((job, i) => {
    if (i >= maxJobs) return job;
    const text = normalize(job.bullets.join(" "));
    const add = terms.filter((t) => !termInText(t, text)).slice(0, 3);
    if (!add.length) return job;
    const bullet = `Drove delivery involving ${add.join(", ")}, clarifying requirements and shipping measurable outcomes.`;
    return { ...job, bullets: [bullet, ...job.bullets].slice(0, 8) };
  });
  return { ...resume, experience };
}

/**
 * Intensity controls how much JD coverage is forced into the resume.
 * subtle  — light skill + summary weave
 * medium  — most must-haves/tools into skills + bullets
 * hard    — cover nearly the full JD stack
 */
export function injectJdCoverage(
  resume: StructuredResume,
  analysis: JdAnalysis,
  intensity: TailorIntensity,
): StructuredResume {
  const pool = uniqueTerms([
    ...analysis.mustHave,
    ...analysis.tools,
    ...analysis.keywords.slice(0, 24),
  ]);

  const limit =
    intensity === "hard" ? 18 : intensity === "medium" ? 12 : 5;
  const missing = takeMissing(resume, pool, limit);
  if (!missing.length) return resume;

  let next = resume;
  const skillCat = intensity === "hard" ? "Core Competencies" : "Skills";
  next = mergeSkillGroup(next, skillCat, missing);
  next = {
    ...next,
    summary: weaveSummary(next.summary, missing, intensity),
  };
  if (intensity !== "subtle") {
    next = enrichBullets(next, missing, intensity === "hard" ? 3 : 2);
  }

  // Soft-target role language in headline for medium/hard
  if (intensity !== "subtle" && analysis.titleHints[0]) {
    const title = analysis.titleHints[0];
    if (!normalize(next.headline || "").includes(normalize(title))) {
      next = {
        ...next,
        headline: next.headline?.trim()
          ? `${title} | ${next.headline}`
          : title,
      };
    }
  }

  return next;
}

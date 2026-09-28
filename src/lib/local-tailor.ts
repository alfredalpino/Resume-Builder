import {
  analyzeJobDescription,
  type JdAnalysis,
} from "@/lib/ats-score";
import {
  resumeToPlainText,
  type StructuredResume,
} from "@/lib/schema";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.#/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function overlapScore(text: string, keywords: string[]): number {
  const n = normalize(text);
  let score = 0;
  for (const k of keywords) {
    const kn = normalize(k);
    if (!kn) continue;
    if (n.includes(kn)) score += kn.includes(" ") ? 3 : 1;
  }
  return score;
}

function uniquePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = normalize(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function stripPreviousCorruption(text: string): string {
  return text
    .replace(/\s*Core strengths aligned to this role include[^.]*\.?/gi, "")
    .replace(/,?\s*applying\s+[A-Z][^.]{0,60}\./gi, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Smart Thinking tailor (locked default).
 * Never invents facts. Never injects raw JD tokens into bullets/summary.
 * Only: clean prior corruption, reorder by relevance, prioritize real
 * resume skills that overlap the JD analysis.
 */
export function tailorResumeSmart(
  resume: StructuredResume,
  jobDescription: string,
  analysis?: JdAnalysis,
): { resume: StructuredResume; thinking: string[]; analysis: JdAnalysis } {
  const analyzed = analysis ?? analyzeJobDescription(jobDescription);
  const thinking = [...analyzed.thinking];
  const keywords = analyzed.keywords;
  const sourceNorm = normalize(resumeToPlainText(resume));

  const next: StructuredResume = structuredClone(resume);

  // Clean any previous bad runs
  next.summary = stripPreviousCorruption(next.summary);
  next.experience = next.experience.map((job) => ({
    ...job,
    bullets: job.bullets.map(stripPreviousCorruption).filter(Boolean),
  }));
  thinking.push("Removed any prior keyword-spam corruption from summary/bullets.");

  // Skills: keep ORIGINAL skill strings; rank those that overlap JD first
  const originalGroups = resume.skills.length
    ? resume.skills
    : [];
  const allOriginalItems = originalGroups.flatMap((g) => g.items);
  const matchingSkills = uniquePreserve(
    allOriginalItems.filter((item) => overlapScore(item, keywords) > 0),
  );
  const otherSkills = uniquePreserve(
    allOriginalItems.filter((item) => overlapScore(item, keywords) === 0),
  );

  if (matchingSkills.length || otherSkills.length) {
    next.skills = [
      ...(matchingSkills.length
        ? [{ category: "Core Skills", items: matchingSkills }]
        : []),
      ...(otherSkills.length
        ? [{ category: "Additional Skills", items: otherSkills }]
        : []),
    ];
    thinking.push(
      matchingSkills.length
        ? `Ranked ${matchingSkills.length} existing resume skills that overlap the JD.`
        : "No direct skill overlaps found; kept original skills unchanged in order.",
    );
  } else {
    thinking.push("No structured skills on source resume; left skills section as-is.");
  }

  // Headline: only if empty — use title hints that appear in resume text
  if (!next.headline.trim()) {
    const evidencedTitles = analyzed.titleHints.filter((t) =>
      sourceNorm.includes(normalize(t)),
    );
    if (evidencedTitles.length) {
      next.headline = evidencedTitles.slice(0, 3).join(" | ");
      thinking.push(`Filled empty headline from evidenced role phrases: ${next.headline}.`);
    }
  }

  // Summary: do NOT append keyword lists. Only trim corruption.
  // Optionally move matching skill names already in summary — no mutation beyond cleanup.
  thinking.push(
    "Left professional summary factually intact (no keyword stuffing).",
  );

  // Experience: reorder jobs/bullets by relevance ONLY — never rewrite bullet text
  next.experience = next.experience
    .map((job) => ({
      ...job,
      bullets: [...job.bullets].sort(
        (a, b) => overlapScore(b, keywords) - overlapScore(a, keywords),
      ),
    }))
    .sort(
      (a, b) =>
        overlapScore(
          `${b.title} ${b.company} ${b.bullets.join(" ")}`,
          keywords,
        ) -
        overlapScore(
          `${a.title} ${a.company} ${a.bullets.join(" ")}`,
          keywords,
        ),
    );
  thinking.push(
    "Reordered experience and bullets by JD relevance without changing wording.",
  );

  next.projects = next.projects
    .map((p) => ({
      ...p,
      bullets: [...p.bullets].sort(
        (a, b) => overlapScore(b, keywords) - overlapScore(a, keywords),
      ),
    }))
    .sort(
      (a, b) =>
        overlapScore(`${b.name} ${b.bullets.join(" ")}`, keywords) -
        overlapScore(`${a.name} ${a.bullets.join(" ")}`, keywords),
    );

  next.certifications = [...next.certifications].sort(
    (a, b) => overlapScore(b, keywords) - overlapScore(a, keywords),
  );

  next.contact = {
    ...resume.contact,
    links: [...resume.contact.links],
  };

  const gaps = keywords.filter((k) => !sourceNorm.includes(normalize(k))).slice(0, 8);
  thinking.push(
    gaps.length
      ? `Reported honest gaps (not invented into resume): ${gaps.join(", ")}.`
      : "Source resume already covers the high-signal JD terms well.",
  );

  return { resume: next, thinking, analysis: analyzed };
}

/** @deprecated use tailorResumeSmart */
export function tailorResumeLocally(
  resume: StructuredResume,
  jobDescription: string,
): StructuredResume {
  return tailorResumeSmart(resume, jobDescription).resume;
}

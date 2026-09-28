import {
  analyzeJobDescription,
  normalize,
  type JdAnalysis,
} from "@/lib/nlp";
import {
  resumeToPlainText,
  type StructuredResume,
} from "@/lib/schema";

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
 * Smart Thinking tailor — locked default.
 * Uses JD analysis from NLP libs. Never invents facts or stuffs keywords.
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

  next.summary = stripPreviousCorruption(next.summary);
  next.experience = next.experience.map((job) => ({
    ...job,
    bullets: job.bullets.map(stripPreviousCorruption).filter(Boolean),
  }));
  next.skills = next.skills
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) =>
          !/^(not|help|fast|customers|all|know|do|care|it)$/i.test(item.trim()),
      ),
    }))
    .filter((g) => g.items.length > 0);
  thinking.push("Scrubbed any legacy keyword-spam from summary, skills, and bullets.");

  const allOriginalItems = (resume.skills.length ? resume.skills : next.skills).flatMap(
    (g) => g.items,
  );
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
        ? `Ranked ${matchingSkills.length} existing skills that overlap the JD.`
        : "Kept original skills; no direct keyword overlap in skill labels.",
    );
  }

  if (!next.headline.trim()) {
    const evidencedTitles = analyzed.titleHints.filter((t) =>
      sourceNorm.includes(normalize(t)),
    );
    if (evidencedTitles.length) {
      next.headline = evidencedTitles.slice(0, 3).join(" | ");
      thinking.push(`Filled empty headline from evidenced roles: ${next.headline}.`);
    }
  }

  thinking.push("Left summary wording intact (no keyword stuffing).");

  next.experience = next.experience
    .map((job) => ({
      ...job,
      bullets: [...job.bullets].sort(
        (a, b) => overlapScore(b, keywords) - overlapScore(a, keywords),
      ),
    }))
    .sort(
      (a, b) =>
        overlapScore(`${b.title} ${b.company} ${b.bullets.join(" ")}`, keywords) -
        overlapScore(`${a.title} ${a.company} ${a.bullets.join(" ")}`, keywords),
    );
  thinking.push("Reordered experience/bullets by JD relevance without rewriting claims.");

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

  const gaps = keywords
    .filter((k) => !sourceNorm.includes(normalize(k)))
    .slice(0, 8);
  thinking.push(
    gaps.length
      ? `Honest gaps reported only (not invented): ${gaps.join(", ")}.`
      : "Source resume covers high-signal JD terms well.",
  );

  return { resume: next, thinking, analysis: analyzed };
}

export function tailorResumeLocally(
  resume: StructuredResume,
  jobDescription: string,
): StructuredResume {
  return tailorResumeSmart(resume, jobDescription).resume;
}

import { extractJdKeywords } from "@/lib/ats-score";
import {
  resumeToPlainText,
  type StructuredResume,
} from "@/lib/schema";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+.#/\s-]/g, " ");
}

function overlapScore(text: string, keywords: string[]): number {
  const n = normalize(text);
  let score = 0;
  for (const k of keywords) {
    if (n.includes(k.toLowerCase())) score += 1;
  }
  return score;
}

function uniquePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function displayKeyword(term: string): string {
  if (term === term.toUpperCase() && term.length <= 6) return term;
  return term
    .split(/[\s_-]+/)
    .map((w) =>
      w.length <= 3 && /[A-Z]/.test(w)
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/**
 * Truthful local tailor — no API key.
 * Reorders content and weaves JD keywords already evidenced in the resume.
 * Never invents employers, degrees, metrics, or new skills.
 */
export function tailorResumeLocally(
  resume: StructuredResume,
  jobDescription: string,
): StructuredResume {
  const keywords = extractJdKeywords(jobDescription);
  const sourceNorm = normalize(resumeToPlainText(resume));
  const evidenced = keywords.filter((k) =>
    sourceNorm.includes(k.toLowerCase()),
  );

  const next: StructuredResume = structuredClone(resume);

  if (!next.headline.trim()) {
    const roleHits = evidenced.slice(0, 4).map(displayKeyword);
    if (roleHits.length) next.headline = roleHits.join(" | ");
  }

  const originalItems = next.skills.flatMap((g) => g.items);
  const jdItems = uniquePreserve(evidenced.map(displayKeyword)).slice(0, 18);
  const otherItems = uniquePreserve(
    originalItems.filter(
      (item) =>
        !evidenced.some((k) => normalize(item).includes(k.toLowerCase())),
    ),
  ).slice(0, 30);

  if (jdItems.length || otherItems.length) {
    next.skills = [
      ...(jdItems.length ? [{ category: "Job-Relevant", items: jdItems }] : []),
      ...(otherItems.length
        ? [{ category: "Additional", items: otherItems }]
        : []),
    ];
  }

  const weave = evidenced.slice(0, 8).map(displayKeyword);
  if (weave.length) {
    const clause = `Core strengths aligned to this role include ${weave.join(", ")}.`;
    const base = next.summary.trim();
    if (!base) {
      next.summary = clause;
    } else if (!normalize(base).includes("aligned to this role")) {
      next.summary = `${base.replace(/\s+$/, "")} ${clause}`.slice(0, 900);
    }
  }

  next.experience = next.experience
    .map((job) => {
      const bullets = [...job.bullets].sort(
        (a, b) => overlapScore(b, keywords) - overlapScore(a, keywords),
      );
      const jobNorm = normalize(
        `${job.title} ${job.company} ${bullets.join(" ")}`,
      );
      const unused = evidenced
        .filter((k) => !jobNorm.includes(k.toLowerCase()))
        .slice(0, 2)
        .map(displayKeyword);
      if (unused.length && bullets.length) {
        bullets[0] =
          `${bullets[0].replace(/\.$/, "")}, applying ${unused.join(" and ")}.`;
      }
      return { ...job, bullets };
    })
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

  return next;
}

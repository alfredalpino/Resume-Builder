import {
  analyzeJobDescription,
  normalize,
  termInText,
  tfidfSimilarity,
  type JdAnalysis,
} from "@/lib/nlp";
import {
  resumeToPlainText,
  type AtsScore,
  type StructuredResume,
} from "@/lib/schema";

export type { JdAnalysis };
export { analyzeJobDescription } from "@/lib/nlp";
export { extractJdKeywords } from "@/lib/nlp";

function computeFormatScore(resume: StructuredResume): {
  score: number;
  notes: string[];
} {
  const notes: string[] = [];
  let earned = 0;
  const checks: { ok: boolean; note: string; weight: number }[] = [
    {
      ok: Boolean(resume.contact.fullName && resume.contact.fullName !== "Your Name"),
      note: "Include a clear full name",
      weight: 12,
    },
    { ok: Boolean(resume.contact.email), note: "Add an email address", weight: 12 },
    {
      ok: Boolean(resume.summary && resume.summary.length > 40),
      note: "Add a professional summary",
      weight: 16,
    },
    {
      ok: resume.skills.some((g) => g.items.length > 0),
      note: "Add a skills section with real skills",
      weight: 16,
    },
    {
      ok: resume.experience.length > 0,
      note: "Add professional experience",
      weight: 20,
    },
    { ok: resume.education.length > 0, note: "Add education", weight: 12 },
    { ok: true, note: "Keep a single-column layout", weight: 12 },
  ];
  for (const c of checks) {
    if (c.ok) earned += c.weight;
    else notes.push(c.note);
  }
  return { score: earned, notes };
}

export function scoreResume(
  resume: StructuredResume,
  jdText: string,
  analysis?: JdAnalysis,
): AtsScore & { thinking?: string[]; similarity?: number } {
  const analyzed = analysis ?? analyzeJobDescription(jdText);
  const text = resumeToPlainText(resume);
  const normResume = normalize(text);
  const keywords = analyzed.keywords;

  const hits: string[] = [];
  const missing: string[] = [];
  for (const term of keywords) {
    if (termInText(term, normResume)) hits.push(term);
    else missing.push(term);
  }

  const weighted = keywords.map((term) => {
    const w =
      analyzed.mustHave.some((m) => normalize(m) === normalize(term)) ||
      analyzed.tools.some((m) => normalize(m) === normalize(term))
        ? 2
        : 1;
    return { w, hit: termInText(term, normResume) };
  });
  const totalW = weighted.reduce((s, x) => s + x.w, 0) || 1;
  const earnedW = weighted.reduce((s, x) => s + (x.hit ? x.w : 0), 0);
  const keywordScore = keywords.length === 0 ? 55 : (earnedW / totalW) * 100;

  const similarity = tfidfSimilarity(text, jdText);
  const similarityPct = Math.max(0, Math.min(100, similarity * 100));
  const formatResult = computeFormatScore(resume);
  const matchRate = Math.round(
    keywordScore * 0.45 + similarityPct * 0.3 + formatResult.score * 0.25,
  );

  const thinking = [
    `Matched ${hits.length}/${keywords.length} skill/role terms.`,
    hits.length
      ? `Overlaps: ${hits.slice(0, 8).join(", ")}.`
      : "Few skill overlaps — keep source facts; do not invent skills.",
    missing.length
      ? `Skill gaps: ${missing.slice(0, 8).join(", ")}.`
      : "No major skill gaps vs JD stack.",
  ];

  return {
    matchRate,
    keywordScore: Math.round(keywordScore * 10) / 10,
    formatScore: Math.round(formatResult.score * 10) / 10,
    hits: hits.slice(0, 25),
    missing: missing.slice(0, 25),
    formatNotes: formatResult.notes,
    target: 75,
    thinking,
    similarity: Math.round(similarityPct * 10) / 10,
  };
}

import {
  resumeToPlainText,
  type AtsScore,
  type StructuredResume,
} from "@/lib/schema";

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "for", "on", "with", "by",
  "at", "from", "as", "is", "are", "be", "this", "that", "you", "your", "we",
  "our", "will", "can", "must", "should", "have", "has", "been", "using",
  "work", "role", "job", "team", "experience", "years", "year", "etc",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+.#/\s-]/g, " ");
}

export function extractJdKeywords(jdText: string): string[] {
  const tokens = normalize(jdText)
    .split(/[\s,/|;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP.has(t));

  const multi = [
    ...jdText.matchAll(
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}|[A-Z]{2,}(?:\s*[A-Z0-9+.#-]*)*|[\w.+#-]{2,}\/?[\w.+#-]*)\b/g,
    ),
  ]
    .map((m) => m[1].trim())
    .filter((t) => t.length >= 2 && !STOP.has(t.toLowerCase()));

  const counts = new Map<string, number>();
  for (const t of [...tokens, ...multi.map((m) => m.toLowerCase())]) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([term]) => term);
}

function computeFormatScore(resume: StructuredResume, text: string): {
  score: number;
  notes: string[];
} {
  const notes: string[] = [];
  let earned = 0;
  const checks: { ok: boolean; note: string; weight: number }[] = [
    {
      ok: Boolean(resume.contact.fullName && resume.contact.fullName !== "Your Name"),
      note: "Include a clear full name",
      weight: 10,
    },
    {
      ok: Boolean(resume.contact.email),
      note: "Add an email address",
      weight: 10,
    },
    {
      ok: Boolean(resume.summary && resume.summary.length > 40),
      note: "Add a professional summary",
      weight: 15,
    },
    {
      ok: resume.skills.length > 0,
      note: "Add a skills section",
      weight: 15,
    },
    {
      ok: resume.experience.length > 0,
      note: "Add professional experience",
      weight: 20,
    },
    {
      ok: resume.education.length > 0,
      note: "Add education",
      weight: 10,
    },
    {
      ok: !/\|.+\|/.test(text.split("\n")[0] || "") || true,
      note: "Keep a single-column layout (no tables/columns)",
      weight: 10,
    },
    {
      ok: normalize(text).includes("linkedin") || resume.contact.links.some((l) =>
        l.url.toLowerCase().includes("linkedin"),
      ),
      note: "Include a LinkedIn or professional profile link",
      weight: 10,
    },
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
): AtsScore {
  const text = resumeToPlainText(resume);
  const normResume = normalize(text);
  const keywords = extractJdKeywords(jdText);

  const hits: string[] = [];
  const missing: string[] = [];
  for (const term of keywords) {
    if (normResume.includes(term.toLowerCase())) hits.push(term);
    else missing.push(term);
  }

  const keywordScore =
    keywords.length === 0 ? 50 : (hits.length / keywords.length) * 100;
  const formatResult = computeFormatScore(resume, text);
  const matchRate = Math.round(keywordScore * 0.65 + formatResult.score * 0.35);

  return {
    matchRate,
    keywordScore: Math.round(keywordScore * 10) / 10,
    formatScore: Math.round(formatResult.score * 10) / 10,
    hits: hits.slice(0, 25),
    missing: missing.slice(0, 25),
    formatNotes: formatResult.notes,
    target: 75,
  };
}

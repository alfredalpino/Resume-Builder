import type { AtsScore, StructuredResume } from "@/lib/schema";
import { resumeToPlainText } from "@/lib/schema";

/** Aggressive English + JD boilerplate stop list */
const STOP = new Set(
  `
a an the and or of to in for on with by at from as is are be been being
this that these those it its you your we our they their them he she his her
will can could should would may might must shall need needs needed
have has had having do does did doing done
i me my mine us
not no nor none any all each every either neither both few more most other
such same so than then too very just also only even still yet already
about into onto over under again further once here there when where why how
what which who whom whose
if because until while although though unless
up down out off above below between through during before after
am was were being
get got getting make made making take took taking give gave giving
use used using go going come coming see look want like know think feel
help helps helping
work works working worker workers role roles job jobs team teams
experience experiences year years month months day days time times
etc eg ie via per
company companies people person persons candidates candidate applicants
applicant looking join joining hiring hire hired opportunity opportunities
position positions opening openings description descriptions
responsibilities responsibility requirements requirement required prefers preferred
nice plus bonus equal opportunity employer eeoc disability accommodation
please send apply application applications resume cv cover letter
ability able strong highly highlymotivated motivated passionate excited
eager willing ready proven track record across within including including
based located location locations office remote hybrid onsite on-site
full-time part-time contract internship
berlin london new york san francisco india usa uk
fast quickly quickly learn learning growth growing
build building built ship shipping shipped
problem problems solve solving solution solutions
product products agent agents engineer engineers engineering
user users customer customers client clients
what we are looking for about the about us who we
comply complydo
`.split(/\s+/).filter(Boolean),
);

const TECH_PHRASE_RE =
  /\b(?:(?:[A-Z][a-z0-9+#.]{1,}(?:\s+[A-Z][a-z0-9+#.\/-]{1,}){0,3})|(?:[A-Z]{2,}(?:[-\s]?[A-Z0-9+#.]{1,})*)|(?:Python|JavaScript|TypeScript|React|Node\.?js|Next\.?js|PostgreSQL|MongoDB|Kubernetes|Docker|AWS|Azure|GCP|Linux|Git|GraphQL|REST|API|SQL|NoSQL|Kafka|Redis|Terraform|Ansible|CI\/CD|DevOps|SRE|MLOps|LLM|RAG|OpenAI|Gemini|PyTorch|TensorFlow|Spark|Snowflake|dbt|Airflow|Figma|Jira|ServiceNow|Salesforce|HubSpot|Zendesk|Freshdesk|CRM|SLA|CSAT|KPI|SOP|QA|BPO|NOC|VPN|VLAN|TCP\/IP|DNS|DHCP|BGP|OSPF|CCNA|CompTIA|Excel|Word|PowerPoint|Outlook|TikTok|Instagram|SEO|SEM|PPC|HTML|CSS|Tailwind|Prisma|Supabase|Vercel|Cloudflare|Auth0|OAuth|SSO|RBAC|GDPR|SOC\s?2|HIPAA|ISO\s?\d+|PCI[\s-]?DSS))\b/gi;

const SKILL_LINE_RE =
  /(?:skills?|technologies|tech stack|tools?|stack|requirements?|qualifications?|must[- ]haves?|nice[- ]to[- ]haves?)\s*[:\-–—]\s*([^\n]+)/gi;

export type JdAnalysis = {
  titleHints: string[];
  mustHave: string[];
  niceToHave: string[];
  tools: string[];
  softSkills: string[];
  keywords: string[]; // ranked display terms for scoring
  thinking: string[]; // human-readable reasoning steps
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+.#/\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function isJunkToken(token: string): boolean {
  const t = token.toLowerCase().trim();
  if (!t || t.length < 3) return true;
  if (STOP.has(t)) return true;
  if (/^\d+$/.test(t)) return true;
  if (/^(http|https|www)$/i.test(t)) return true;
  // pure filler short verbs/nouns that slipped through
  if (
    [
      "help",
      "fast",
      "care",
      "know",
      "want",
      "hard",
      "join",
      "ship",
      "build",
      "built",
      "shape",
      "about",
      "looking",
      "company",
      "people",
      "users",
      "agents",
      "who",
      "what",
      "all",
      "not",
      "do",
      "it",
    ].includes(t)
  ) {
    return true;
  }
  return false;
}

function cleanPhrase(raw: string): string | null {
  let p = raw
    .replace(/[•|·,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Drop sentence tails accidentally glued on
  p = p.split(/\.\s+/)[0] ?? p;
  p = p.replace(/\.+$/g, "").trim();
  p = p.replace(/^[^A-Za-z0-9+#]+|[^A-Za-z0-9+#/)\]]+$/g, "").trim();
  if (!p || p.length < 2 || p.length > 42) return null;
  if (isJunkToken(p)) return null;

  const parts = normalize(p).split(" ").filter(Boolean);
  const meaningful = parts.filter((w) => !STOP.has(w) && w.length > 2);
  if (meaningful.length === 0) return null;

  // Reject sentence-like fragments ("to build hard product", "care about customers")
  if (parts.length >= 3) {
    const stopRatio = parts.filter((w) => STOP.has(w)).length / parts.length;
    if (stopRatio >= 0.34) return null;
    if (
      STOP.has(parts[0]) ||
      ["to", "for", "and", "with", "from", "about"].includes(parts[0])
    ) {
      return null;
    }
  }

  if (parts.length === 1 && parts[0].length < 4 && !/[A-Z0-9+#./]/.test(raw.trim())) {
    return null;
  }
  return p;
}

function uniqueRanked(items: string[], limit = 35): string[] {
  const scores = new Map<string, { display: string; score: number }>();
  for (let i = 0; i < items.length; i++) {
    const display = items[i];
    const key = normalize(display);
    if (!key || isJunkToken(key)) continue;
    const prev = scores.get(key);
    const boost = display.includes(" ") ? 3 : /[A-Z]{2,}|\d|\+|\/|\./.test(display) ? 2 : 1;
    const score = boost + (items.length - i) * 0.01;
    if (!prev || score > prev.score) scores.set(key, { display, score });
  }
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((v) => v.display);
}

/**
 * Smart JD analysis — phrase-first, stopword-hostile.
 * Returns structured thinking steps for the UI.
 */
export function analyzeJobDescription(jdText: string): JdAnalysis {
  const thinking: string[] = [];
  const text = jdText.replace(/\r/g, "").trim();
  thinking.push("Read the full job description and strip boilerplate language.");

  const titleHints: string[] = [];
  const titleLine = text.split("\n").map((l) => l.trim()).find(Boolean) || "";
  const titleMatch = titleLine.match(
    /^(.{3,80}?)(?:\s+[-|@]\s+|\s+at\s+)/i,
  );
  if (titleMatch) titleHints.push(titleMatch[1].trim());
  const roleHints = [
    ...text.matchAll(
      /\b((?:Senior|Junior|Staff|Principal|Lead|Associate)?\s?(?:Software|Network|Security|Data|ML|AI|Product|Customer|Support|Sales|Marketing|DevOps|Cloud|Frontend|Backend|Full[- ]?Stack)?\s?(?:Engineer|Developer|Analyst|Manager|Specialist|Representative|Associate|Executive|Designer|Architect|Administrator|Consultant|Intern)s?)\b/gi,
    ),
  ].map((m) => m[1].trim());
  titleHints.push(...roleHints);
  thinking.push(
    titleHints.length
      ? `Detected role signals: ${uniqueRanked(titleHints, 5).join(", ")}.`
      : "No clear job title detected; scoring from skills and tools only.",
  );

  const tools: string[] = [];
  let m: RegExpExecArray | null;
  const techRe = new RegExp(TECH_PHRASE_RE.source, "gi");
  while ((m = techRe.exec(text)) !== null) {
    const cleaned = cleanPhrase(m[0]);
    if (cleaned) tools.push(cleaned);
  }

  const skillLineHits: string[] = [];
  const skillRe = new RegExp(SKILL_LINE_RE.source, "gi");
  while ((m = skillRe.exec(text)) !== null) {
    for (const part of m[1].split(/[,|/•·;]/)) {
      const cleaned = cleanPhrase(part);
      if (cleaned) skillLineHits.push(cleaned);
    }
  }

  const mustHave: string[] = [];
  const niceToHave: string[] = [];
  const sections = text.split(/\n(?=[A-Z][A-Za-z ]{2,40}:|\*\*|#{1,3}\s)/);
  for (const section of sections) {
    const head = section.slice(0, 80).toLowerCase();
    const bodyTerms = [
      ...section.matchAll(
        /\b([A-Za-z][A-Za-z0-9+.#/-]{2,}(?:\s+[A-Za-z][A-Za-z0-9+.#/-]{1,}){0,3})\b/g,
      ),
    ]
      .map((x) => cleanPhrase(x[1]))
      .filter((x): x is string => Boolean(x));

    if (/must|required|qualification|requirement|you have|minimum/.test(head)) {
      mustHave.push(...bodyTerms);
    } else if (/nice|bonus|prefer|plus|good to have/.test(head)) {
      niceToHave.push(...bodyTerms);
    }
  }

  const softSkills = uniqueRanked(
    [
      ...text.matchAll(
        /\b(communication|collaboration|leadership|ownership|problem[- ]solving|customer[- ]facing|stakeholder management|attention to detail|time management|written communication|verbal communication|cross[- ]functional)\b/gi,
      ),
    ].map((x) => x[1]),
    12,
  );

  const keywords = uniqueRanked(
    [
      ...titleHints,
      ...mustHave,
      ...tools,
      ...skillLineHits,
      ...niceToHave,
      ...softSkills,
    ],
    40,
  ).filter((k) => !isJunkToken(k));

  thinking.push(
    `Extracted ${keywords.length} high-signal terms (tools, role phrases, must-haves). Filtered stopwords and filler.`,
  );
  thinking.push(
    mustHave.length
      ? `Prioritized must-have themes first (${uniqueRanked(mustHave, 6).join(", ")}).`
      : "No explicit must-have section; weighting tools and role phrases higher.",
  );

  return {
    titleHints: uniqueRanked(titleHints, 8),
    mustHave: uniqueRanked(mustHave, 20),
    niceToHave: uniqueRanked(niceToHave, 15),
    tools: uniqueRanked(tools, 25),
    softSkills,
    keywords,
    thinking,
  };
}

export function extractJdKeywords(jdText: string): string[] {
  return analyzeJobDescription(jdText).keywords;
}

function termInResume(term: string, resumeNorm: string): boolean {
  const n = normalize(term);
  if (!n) return false;
  if (resumeNorm.includes(n)) return true;
  // allow stem-ish containment for multiword: each significant token
  const parts = n.split(" ").filter((w) => w.length > 3 && !STOP.has(w));
  if (parts.length >= 2) {
    return parts.every((p) => resumeNorm.includes(p));
  }
  return false;
}

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
    {
      ok: Boolean(resume.contact.email),
      note: "Add an email address",
      weight: 12,
    },
    {
      ok: Boolean(resume.summary && resume.summary.length > 40),
      note: "Add a professional summary",
      weight: 16,
    },
    {
      ok: resume.skills.length > 0 && resume.skills.some((g) => g.items.length > 0),
      note: "Add a skills section with real skills",
      weight: 16,
    },
    {
      ok: resume.experience.length > 0,
      note: "Add professional experience",
      weight: 20,
    },
    {
      ok: resume.education.length > 0,
      note: "Add education",
      weight: 12,
    },
    {
      ok: true,
      note: "Keep a single-column layout (no tables/columns)",
      weight: 12,
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
  analysis?: JdAnalysis,
): AtsScore & { thinking?: string[] } {
  const analyzed = analysis ?? analyzeJobDescription(jdText);
  const text = resumeToPlainText(resume);
  const normResume = normalize(text);
  const keywords = analyzed.keywords;

  const hits: string[] = [];
  const missing: string[] = [];
  for (const term of keywords) {
    if (termInResume(term, normResume)) hits.push(term);
    else missing.push(term);
  }

  // Weight must-haves / tools higher in keyword score
  const weighted = keywords.map((term) => {
    const w =
      analyzed.mustHave.some((m) => normalize(m) === normalize(term)) ||
      analyzed.tools.some((m) => normalize(m) === normalize(term))
        ? 2
        : 1;
    return { term, w, hit: termInResume(term, normResume) };
  });
  const totalW = weighted.reduce((s, x) => s + x.w, 0) || 1;
  const earnedW = weighted.reduce((s, x) => s + (x.hit ? x.w : 0), 0);
  const keywordScore = keywords.length === 0 ? 55 : (earnedW / totalW) * 100;
  const formatResult = computeFormatScore(resume);
  const matchRate = Math.round(keywordScore * 0.7 + formatResult.score * 0.3);

  const thinking = [
    ...analyzed.thinking,
    `Matched ${hits.length}/${keywords.length} high-signal terms.`,
    hits.length
      ? `Strong overlaps: ${hits.slice(0, 8).join(", ")}.`
      : "Few keyword overlaps — emphasize genuine matching skills from the source resume.",
    missing.length
      ? `Honest gaps (do not invent): ${missing.slice(0, 8).join(", ")}.`
      : "No major high-signal gaps against this JD.",
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
  };
}

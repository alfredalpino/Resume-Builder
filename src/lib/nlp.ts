import nlp from "compromise";
import keyword from "keyword-extractor";
import { removeStopwords, eng } from "stopword";
import { TfIdf, WordTokenizer } from "natural";

export type JdAnalysis = {
  titleHints: string[];
  mustHave: string[];
  niceToHave: string[];
  tools: string[];
  softSkills: string[];
  keywords: string[];
  thinking: string[];
};

const EXTRA_STOP = new Set(
  `
looking join joining hire hiring hired company companies people person candidates candidate
applicant applicants opportunity opportunities position positions opening openings
description descriptions responsibilities responsibility requirements requirement required
preferred prefer nice bonus plus equal employer please send apply application applications
resume cv cover letter ability able strong highly motivated passionate excited eager willing
ready proven track record across within including based located location remote hybrid
full-time part-time contract internship experience experiences years year months month
team teams role roles job jobs work works working worker about want wants know knows
help helps helping care cares fast quickly hard build building built ship shipping shipped
problem problems solve solving solution solutions product products agent agents
engineer engineers engineering user users customer customers client clients
who what when where why how all not do did does done it its this that these those
we our you your they their them
berlin london india usa uk
`.split(/\s+/).filter(Boolean),
);

const TECH_LEXICON = [
  "TypeScript", "JavaScript", "Python", "Java", "Go", "Rust", "C++", "C#",
  "React", "Next.js", "Node.js", "Vue", "Angular", "Svelte",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "SQL", "NoSQL",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible",
  "Linux", "Git", "CI/CD", "GraphQL", "REST", "API", "gRPC",
  "Kafka", "Spark", "Airflow", "dbt", "Snowflake",
  "PyTorch", "TensorFlow", "LLM", "RAG", "OpenAI", "Gemini",
  "CRM", "SLA", "CSAT", "KPI", "SOP", "QA", "BPO", "NOC",
  "Jira", "ServiceNow", "Salesforce", "Zendesk", "Freshdesk", "HubSpot",
  "Excel", "Word", "PowerPoint", "Outlook",
  "TCP/IP", "DNS", "DHCP", "VPN", "VLAN", "BGP", "OSPF", "CCNA",
  "CompTIA", "GDPR", "SOC 2", "HIPAA", "ISO 27001", "PCI DSS",
  "HTML", "CSS", "Tailwind", "Prisma", "Supabase", "Vercel", "Auth0", "OAuth", "SSO", "RBAC",
];

const ROLE_RE =
  /\b((?:Senior|Junior|Staff|Principal|Lead|Associate)?\s?(?:Software|Network|Security|Data|ML|AI|Product|Customer|Support|Sales|Marketing|DevOps|Cloud|Frontend|Backend|Full[- ]?Stack|Voice|Non[- ]?Voice)?\s?(?:Engineer|Developer|Analyst|Manager|Specialist|Representative|Associate|Executive|Designer|Architect|Administrator|Consultant|Intern|Agent)s?)\b/gi;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.#/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTerm(raw: string): string | null {
  let p = raw.replace(/\s+/g, " ").trim();
  p = p.replace(/^[^A-Za-z0-9+#]+|[^A-Za-z0-9+#/)\]]+$/g, "").replace(/\.+$/g, "").trim();
  if (!p || p.length < 2 || p.length > 42) return null;
  const key = normalize(p);
  if (!key || EXTRA_STOP.has(key)) return null;
  const parts = key.split(" ").filter(Boolean);
  if (parts.every((w) => EXTRA_STOP.has(w) || eng.includes(w))) return null;
  if (parts.length >= 3) {
    const stopish = parts.filter((w) => EXTRA_STOP.has(w) || eng.includes(w)).length;
    if (stopish / parts.length >= 0.4) return null;
    if (["to", "for", "and", "with", "from", "about", "the", "a"].includes(parts[0])) {
      return null;
    }
  }
  if (parts.length === 1 && parts[0].length < 3) return null;
  return p;
}

function uniqueRanked(items: string[], limit = 40): string[] {
  const map = new Map<string, { display: string; score: number }>();
  items.forEach((item, i) => {
    const cleaned = cleanTerm(item);
    if (!cleaned) return;
    const key = normalize(cleaned);
    const boost =
      TECH_LEXICON.some((t) => normalize(t) === key) ? 5 :
      cleaned.includes(" ") ? 3 :
      /[A-Z]{2,}|\d|\+|\/|\./.test(cleaned) ? 2 : 1;
    const score = boost + (items.length - i) * 0.01;
    const prev = map.get(key);
    if (!prev || score > prev.score) map.set(key, { display: cleaned, score });
  });
  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((v) => v.display);
}

function extractWithKeywordExtractor(text: string): string[] {
  try {
    const words = keyword.extract(text, {
      language: "english",
      remove_digits: false,
      return_changed_case: false,
      remove_duplicates: true,
    });
    return words
      .map((w) => cleanTerm(w))
      .filter((w): w is string => Boolean(w));
  } catch {
    return [];
  }
}

function extractNounPhrases(text: string): string[] {
  try {
    const doc = nlp(text);
    const phrases = [
      ...doc.topics().out("array"),
      ...doc.nouns().out("array"),
      ...doc.organizations().out("array"),
    ] as string[];
    return phrases
      .map((p) => cleanTerm(String(p)))
      .filter((p): p is string => Boolean(p));
  } catch {
    return [];
  }
}

function extractLexiconHits(text: string): string[] {
  const n = normalize(text);
  return TECH_LEXICON.filter((term) => n.includes(normalize(term)));
}

function extractRoles(text: string): string[] {
  return [...text.matchAll(ROLE_RE)].map((m) => m[1].trim());
}

function sectionTerms(text: string, kind: "must" | "nice"): string[] {
  const out: string[] = [];
  const blocks = text.split(/\n{2,}|\r\n{2,}/);
  for (const block of blocks) {
    const head = block.slice(0, 120).toLowerCase();
    const isMust = /must|required|qualification|requirement|you have|minimum|what you.ll bring/.test(head);
    const isNice = /nice|bonus|prefer|plus|good to have|about you/.test(head);
    if (kind === "must" && !isMust) continue;
    if (kind === "nice" && !isNice) continue;
    out.push(...extractNounPhrases(block), ...extractWithKeywordExtractor(block));
  }
  return out;
}

/**
 * Smart JD analysis using compromise + keyword-extractor + stopword + tech lexicon.
 */
export function analyzeJobDescription(jdText: string): JdAnalysis {
  const thinking: string[] = [];
  const text = jdText.replace(/\r/g, "").trim();
  thinking.push("Parsed JD with compromise (nouns/topics) + keyword-extractor + stopword filtering.");

  const titleHints = uniqueRanked(extractRoles(text), 8);
  thinking.push(
    titleHints.length
      ? `Role signals: ${titleHints.join(", ")}.`
      : "No clear role title detected.",
  );

  const tools = uniqueRanked(
    [...extractLexiconHits(text), ...extractNounPhrases(text).filter((p) => /[A-Z0-9+#./]/.test(p))],
    25,
  );
  const mustHave = uniqueRanked(sectionTerms(text, "must"), 20);
  const niceToHave = uniqueRanked(sectionTerms(text, "nice"), 15);
  const softSkills = uniqueRanked(
    [...text.matchAll(
      /\b(communication|collaboration|leadership|ownership|problem[- ]solving|customer[- ]facing|stakeholder management|attention to detail|time management)\b/gi,
    )].map((m) => m[1]),
    10,
  );

  const keywords = uniqueRanked(
    [
      ...titleHints,
      ...mustHave,
      ...tools,
      ...extractWithKeywordExtractor(text),
      ...extractNounPhrases(text),
      ...niceToHave,
      ...softSkills,
    ],
    40,
  );

  // Final pass through stopword remover on single tokens
  const filtered = keywords.filter((k) => {
    const parts = normalize(k).split(" ");
    if (parts.length === 1) {
      const kept = removeStopwords(parts, eng);
      return kept.length > 0 && !EXTRA_STOP.has(parts[0]);
    }
    return true;
  });

  thinking.push(`Kept ${filtered.length} high-signal terms after stopword + junk filters.`);
  if (tools.length) thinking.push(`Tools/tech detected: ${tools.slice(0, 8).join(", ")}.`);
  if (mustHave.length) thinking.push(`Must-have themes: ${mustHave.slice(0, 6).join(", ")}.`);

  return {
    titleHints,
    mustHave,
    niceToHave,
    tools,
    softSkills,
    keywords: filtered,
    thinking,
  };
}

export function extractJdKeywords(jdText: string): string[] {
  return analyzeJobDescription(jdText).keywords;
}

/** TF-IDF cosine similarity between JD and resume plain text (natural). */
export function tfidfSimilarity(resumeText: string, jdText: string): number {
  const tfidf = new TfIdf();
  tfidf.addDocument(normalize(jdText));
  tfidf.addDocument(normalize(resumeText));

  const tokenizer = new WordTokenizer();
  const jdTokens = removeStopwords(
    tokenizer.tokenize(normalize(jdText)).filter((t) => t.length > 2),
    eng,
  );
  const unique = [...new Set(jdTokens)].slice(0, 200);
  if (!unique.length) return 0;

  let dot = 0;
  let a2 = 0;
  let b2 = 0;
  for (const term of unique) {
    const a = Number(tfidf.tfidf(term, 0)) || 0;
    const b = Number(tfidf.tfidf(term, 1)) || 0;
    dot += a * b;
    a2 += a * a;
    b2 += b * b;
  }
  if (!a2 || !b2) return 0;
  return dot / (Math.sqrt(a2) * Math.sqrt(b2));
}

export function termInText(term: string, haystackNorm: string): boolean {
  const n = normalize(term);
  if (!n) return false;
  if (haystackNorm.includes(n)) return true;
  const parts = n.split(" ").filter((w) => w.length > 3 && !EXTRA_STOP.has(w) && !eng.includes(w));
  if (parts.length >= 2) return parts.every((p) => haystackNorm.includes(p));
  return false;
}

export { normalize };

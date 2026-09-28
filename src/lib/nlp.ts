import nlp from "compromise";
import keyword from "keyword-extractor";
import { removeStopwords, eng } from "stopword";

export type JdAnalysis = {
  titleHints: string[];
  mustHave: string[];
  niceToHave: string[];
  tools: string[];
  softSkills: string[];
  keywords: string[];
  domain: ResumeDomain;
  thinking: string[];
};

export type ResumeDomain =
  | "software"
  | "ai"
  | "support"
  | "sales"
  | "ops"
  | "general";

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
we our you your they their them berlin london india usa uk seed stage startup
`.split(/\s+/).filter(Boolean),
);

const TECH_LEXICON = [
  "TypeScript", "JavaScript", "Python", "Java", "Go", "Rust", "C++", "C#",
  "React", "Next.js", "Node.js", "Vue", "Angular", "Svelte", "Tailwind", "Tailwind CSS",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Neo4j", "SQLite", "SQL", "NoSQL",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible",
  "Linux", "Git", "CI/CD", "GraphQL", "REST", "API", "gRPC",
  "LangChain", "LangGraph", "OpenAI", "Anthropic", "LLM", "RAG",
  "CRM", "SLA", "CSAT", "KPI", "SOP", "QA", "BPO", "NOC",
  "Jira", "ServiceNow", "Salesforce", "Zendesk", "Freshdesk", "HubSpot",
  "Excel", "MS Excel", "Word", "PowerPoint", "Outlook",
  "HTML", "CSS", "Prisma", "Supabase", "Vercel", "Auth0", "OAuth", "SSO", "RBAC",
  "Cursor", "Claude", "Codex",
];

const ROLE_RE =
  /\b((?:Senior|Junior|Staff|Principal|Lead|Associate)?\s?(?:Software|Network|Security|Data|ML|AI|Product|Customer|Support|Sales|Marketing|DevOps|Cloud|Frontend|Backend|Full[- ]?Stack|Voice|Non[- ]?Voice)?\s?(?:Engineer|Developer|Analyst|Manager|Specialist|Representative|Associate|Executive|Designer|Architect|Administrator|Consultant|Intern|Agent)s?)\b/gi;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.#/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTerm(raw: string): string | null {
  let p = raw.replace(/\s+/g, " ").trim();
  p = p.split(/\.\s+/)[0] ?? p;
  p = p.replace(/\.+$/g, "").trim();
  p = p.replace(/^[^A-Za-z0-9+#]+|[^A-Za-z0-9+#/)\]]+$/g, "").trim();
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
  // Drop glued section headers like "Tech Stack Frontend"
  if (/^(tech stack|frontend|backend|ai layer)\b/i.test(p) && parts.length <= 4) {
    const lexHit = TECH_LEXICON.find((t) => normalize(t) === key);
    if (!lexHit) return null;
  }
  return p;
}

function uniqueRanked(items: string[], limit = 40): string[] {
  const map = new Map<string, { display: string; score: number }>();
  items.forEach((item, i) => {
    const cleaned = cleanTerm(item);
    if (!cleaned) return;
    const key = normalize(cleaned);
    const boost =
      TECH_LEXICON.some((t) => normalize(t) === key) ? 6 :
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
    return keyword
      .extract(text, {
        language: "english",
        remove_digits: false,
        return_changed_case: false,
        remove_duplicates: true,
      })
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
    return phrases.map((p) => cleanTerm(String(p))).filter((p): p is string => Boolean(p));
  } catch {
    return [];
  }
}

function extractLexiconHits(text: string): string[] {
  const n = normalize(text);
  return TECH_LEXICON.filter((term) => n.includes(normalize(term)));
}

function detectDomain(text: string): ResumeDomain {
  const n = normalize(text);
  const software =
    /(typescript|javascript|react|next\.?js|python|software engineer|full.?stack|frontend|backend|mongodb|neo4j|langchain|langgraph|llm)/.test(
      n,
    );
  const ai = /(ai-native|machine learning|llm|langchain|agents?|openai|anthropic)/.test(n);
  const support = /(customer support|bpo|call center|csat|sla|helpdesk|inbound|voice process)/.test(n);
  const sales = /(sales|quota|pipeline|crm closing|account executive)/.test(n);
  if (ai && software) return "ai";
  if (software) return "software";
  if (ai) return "ai";
  if (support) return "support";
  if (sales) return "sales";
  return "general";
}

function sectionTerms(text: string, kind: "must" | "nice"): string[] {
  const out: string[] = [];
  for (const block of text.split(/\n{2,}|\r\n{2,}/)) {
    const head = block.slice(0, 140).toLowerCase();
    const isMust = /must have|required|qualification|requirement|what we are looking for|you will/.test(head);
    const isNice = /nice|bonus|prefer|plus|good to have/.test(head);
    if (kind === "must" && !isMust) continue;
    if (kind === "nice" && !isNice) continue;
    out.push(...extractLexiconHits(block), ...extractNounPhrases(block));
  }
  return out;
}

export function analyzeJobDescription(jdText: string): JdAnalysis {
  const thinking: string[] = [];
  const text = jdText.replace(/\r/g, "").trim();
  thinking.push("Parsed JD with compromise + keyword-extractor + tech lexicon (no external LLM).");

  const domain = detectDomain(text);
  thinking.push(`Detected JD domain: ${domain}.`);

  const titleHints = uniqueRanked([...text.matchAll(ROLE_RE)].map((m) => m[1].trim()), 8);
  const tools = uniqueRanked(extractLexiconHits(text), 25);
  const mustHave = uniqueRanked(
    [...sectionTerms(text, "must"), ...tools.slice(0, 12)],
    20,
  );
  const niceToHave = uniqueRanked(sectionTerms(text, "nice"), 15);
  const softSkills = uniqueRanked(
    [...text.matchAll(
      /\b(communication|collaboration|ownership|problem[- ]solving|bias to action|curiosity|user-facing|ship|iterate)\b/gi,
    )].map((m) => m[1]),
    10,
  );

  const keywords = uniqueRanked(
    [
      ...titleHints,
      ...tools,
      ...mustHave,
      ...extractWithKeywordExtractor(text),
      ...niceToHave,
      ...softSkills,
    ],
    40,
  ).filter((k) => {
    const parts = normalize(k).split(" ");
    if (parts.length === 1) {
      return removeStopwords(parts, eng).length > 0 && !EXTRA_STOP.has(parts[0]);
    }
    return true;
  });

  thinking.push(`High-signal terms kept: ${keywords.slice(0, 12).join(", ") || "(none)"}.`);
  if (tools.length) thinking.push(`Tech stack signals: ${tools.slice(0, 10).join(", ")}.`);

  return {
    titleHints,
    mustHave,
    niceToHave,
    tools,
    softSkills,
    keywords,
    domain,
    thinking,
  };
}

export function extractJdKeywords(jdText: string): string[] {
  return analyzeJobDescription(jdText).keywords;
}

/** Lightweight TF-IDF cosine similarity (no `natural` — avoids Vercel ESM crashes). */
export function tfidfSimilarity(resumeText: string, jdText: string): number {
  const tokenize = (t: string) =>
    removeStopwords(
      normalize(t)
        .split(" ")
        .filter((w) => w.length > 2 && !EXTRA_STOP.has(w)),
      eng,
    );

  const aTokens = tokenize(jdText);
  const bTokens = tokenize(resumeText);
  if (!aTokens.length || !bTokens.length) return 0;

  const df = new Map<string, number>();
  for (const term of new Set(aTokens)) df.set(term, (df.get(term) || 0) + 1);
  for (const term of new Set(bTokens)) df.set(term, (df.get(term) || 0) + 1);

  const tf = (tokens: string[]) => {
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
    const out = new Map<string, number>();
    for (const [term, c] of counts) {
      const idf = Math.log(2 / (df.get(term) || 1)) + 1;
      out.set(term, (c / tokens.length) * idf);
    }
    return out;
  };

  const va = tf(aTokens);
  const vb = tf(bTokens);
  const terms = new Set([...va.keys(), ...vb.keys()]);
  let dot = 0;
  let a2 = 0;
  let b2 = 0;
  for (const term of terms) {
    const a = va.get(term) || 0;
    const b = vb.get(term) || 0;
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
  const parts = n
    .split(" ")
    .filter((w) => w.length > 3 && !EXTRA_STOP.has(w) && !eng.includes(w));
  if (parts.length >= 2) return parts.every((p) => haystackNorm.includes(p));
  return false;
}

export function detectResumeDomain(resumeText: string): ResumeDomain {
  return detectDomain(resumeText);
}

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
  companyHints: string[];
  salaryHints: string[];
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
problem problems solve solving solution solutions product products
who what when where why how all not do did does done it its this that these those
we our you your they their them berlin london india usa uk seed stage startup
things thing day days end stack tech software passion complete fully salary range
compensation package benefits visa citizenship citizenships grads grad new any
save apply global enterprises enterprise category culture whiteboard slack thread
`.split(/\s+/).filter(Boolean),
);

/** Curated 2025-facing lexicon (enriched from public AI/web-stack usage). */
const TECH_LEXICON = [
  "TypeScript", "JavaScript", "Python", "Java", "Go", "Rust", "C++", "C#",
  "React", "Next.js", "Node.js", "Vue", "Angular", "Svelte", "Tailwind", "Tailwind CSS",
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Neo4j", "SQLite", "SQL", "NoSQL", "Weaviate", "Pinecone",
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible",
  "Linux", "Git", "CI/CD", "GraphQL", "REST", "API", "gRPC", "FastAPI", "Express",
  "LangChain", "LangGraph", "LangChain.js", "LangGraph.js", "OpenAI", "Anthropic", "LLM", "RAG",
  "Vercel AI SDK", "AI SDK", "Agents", "Human-in-the-loop", "Evals", "Observability",
  "CRM", "SLA", "CSAT", "KPI", "SOP", "QA", "BPO", "NOC",
  "Jira", "ServiceNow", "Salesforce", "Zendesk", "Freshdesk", "HubSpot",
  "Excel", "MS Excel", "Word", "PowerPoint", "Outlook",
  "HTML", "CSS", "Prisma", "Drizzle", "Supabase", "Neon", "Vercel", "Auth0", "OAuth", "SSO", "RBAC",
  "Cursor", "Claude", "Codex", "Playwright", "Vitest", "Jest",
];

const SOFT_WHITELIST = new Set(
  [
    "communication",
    "collaboration",
    "ownership",
    "problem-solving",
    "problem solving",
    "bias to action",
    "curiosity",
    "user-facing",
    "ship",
    "iterate",
    "end-to-end",
  ].map((s) => normalize(s)),
);

const ROLE_RE =
  /\b((?:Senior|Junior|Staff|Principal|Lead|Associate)?\s?(?:Software|Network|Security|Data|ML|AI|Product|Customer|Support|Sales|Marketing|DevOps|Cloud|Frontend|Backend|Full[- ]?Stack|Voice|Non[- ]?Voice)?\s?(?:Engineer|Developer|Analyst|Manager|Specialist|Representative|Associate|Executive|Designer|Architect|Administrator|Consultant|Intern|Agent)s?)\b/gi;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.#/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip salary, currency, and posting chrome before keyword mining. */
export function stripJdNoise(text: string): string {
  return text
    .replace(/€\s*\d+\s*[kK]\s*[-–—to]+\s*€?\s*\d+\s*[kK](?:\s*(?:EUR|USD|GBP))?/gi, " ")
    .replace(/\$\s*\d[\d,]*(?:\s*[kK])?(?:\s*[-–—to]+\s*\$?\s*\d[\d,]*(?:\s*[kK])?)?/g, " ")
    .replace(/\b\d+\s*[kK]\b/g, " ")
    .replace(/\b(?:USD|EUR|GBP|INR|CAD|AUD)\b/gi, " ")
    .replace(/\([^)]*F\d{2,}\)/gi, " ")
    .replace(/\b(?:full[- ]?time|part[- ]?time|remote|hybrid|onsite|in[- ]?person)\b/gi, " ")
    .replace(/\b(?:us citizenship|visa not required|any \(new grads ok\)|apply|save)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractSalaryHints(text: string): string[] {
  const out: string[] = [];
  const ranges = text.match(
    /(?:€|\$)?\s*\d+\s*[kK]\s*[-–—to]+\s*(?:€|\$)?\s*\d+\s*[kK](?:\s*(?:EUR|USD|GBP))?/gi,
  );
  if (ranges) out.push(...ranges.map((r) => r.trim()));
  return out;
}

function extractCompanyHints(text: string): string[] {
  const out: string[] = [];
  const at = text.match(/\bat\s+([A-Z][A-Za-z0-9&.-]{1,40})/g);
  if (at) {
    for (const m of at) {
      const name = m.replace(/^at\s+/i, "").trim();
      if (name && !/^(the|our|a)$/i.test(name)) out.push(name);
    }
  }
  // Leading brand line like "ComplyDo" or "ComplyDo(F25)"
  const first = text.split(/\n/).map((l) => l.trim()).find(Boolean);
  if (first && /^[A-Z][A-Za-z0-9&.-]{1,40}(?:\([^)]+\))?$/.test(first.split(/\s+/)[0] || "")) {
    out.push(first.split(/\s+/)[0].replace(/\(.*\)$/, ""));
  }
  return [...new Set(out.map((c) => c.replace(/\(.*\)$/, "").trim()).filter(Boolean))];
}

function isNoiseKeyword(term: string, companyHints: string[]): boolean {
  const key = normalize(term);
  if (!key || key.length < 2) return true;
  if (/^\d/.test(key)) return true;
  if (/^(eur|usd|gbp|inr|cad|aud|k|f25|f\d+)$/.test(key)) return true;
  if (EXTRA_STOP.has(key)) return true;
  if (companyHints.some((c) => normalize(c) === key || key.includes(normalize(c)))) return true;
  // Lone generic fragments from keyword-extractor
  if (
    /^(software|tech|stack|nextjs|passion|things|end|day|task|a task|day 1|complete|guide users|improving agents|orchestrating agents|user-facing workflows|regulatory requirements)$/.test(
      key,
    )
  ) {
    return true;
  }
  if (key.split(" ").length === 1 && key.length <= 3 && !TECH_LEXICON.some((t) => normalize(t) === key)) {
    return true;
  }
  return false;
}

function cleanTerm(raw: string, companyHints: string[] = []): string | null {
  let p = raw.replace(/\s+/g, " ").trim();
  p = p.split(/\.\s+/)[0] ?? p;
  p = p.replace(/\.+$/g, "").trim();
  p = p.replace(/^[^A-Za-z0-9+#]+|[^A-Za-z0-9+#/)\]]+$/g, "").trim();
  if (!p || p.length < 2 || p.length > 42) return null;
  if (isNoiseKeyword(p, companyHints)) return null;
  const key = normalize(p);
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
  if (/^(tech stack|frontend|backend|ai layer)\b/i.test(p) && parts.length <= 4) {
    const lexHit = TECH_LEXICON.find((t) => normalize(t) === key);
    if (!lexHit) return null;
  }
  return p;
}

function uniqueRanked(items: string[], companyHints: string[], limit = 40): string[] {
  const map = new Map<string, { display: string; score: number }>();
  items.forEach((item, i) => {
    const cleaned = cleanTerm(item, companyHints);
    if (!cleaned) return;
    const key = normalize(cleaned);
    const boost =
      TECH_LEXICON.some((t) => normalize(t) === key) ? 8 :
      SOFT_WHITELIST.has(key) ? 4 :
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
    return keyword.extract(text, {
      language: "english",
      remove_digits: true,
      return_changed_case: false,
      remove_duplicates: true,
    });
  } catch {
    return [];
  }
}

function extractNounPhrases(text: string): string[] {
  try {
    const doc = nlp(text);
    return [
      ...doc.topics().out("array"),
      ...doc.organizations().out("array"),
    ] as string[];
  } catch {
    return [];
  }
}

function extractLexiconHits(text: string): string[] {
  const n = normalize(text);
  return TECH_LEXICON.filter((term) => termInText(term, n));
}

function detectDomain(text: string): ResumeDomain {
  const n = normalize(text);
  const software =
    /(typescript|javascript|react|next\.?js|python|software engineer|full.?stack|frontend|backend|mongodb|neo4j|langchain|langgraph|llm)/.test(
      n,
    );
  const ai = /(ai-native|machine learning|llm|langchain|langgraph|agents?|openai|anthropic)/.test(n);
  const support = /(customer support|bpo|call center|csat|sla|helpdesk|inbound|voice process|tech support)/.test(n);
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
    const isMust = /must have|required|qualification|requirement|what we are looking for/.test(head);
    const isNice = /nice|bonus|prefer|plus|good to have/.test(head);
    if (kind === "must" && !isMust) continue;
    if (kind === "nice" && !isNice) continue;
    out.push(...extractLexiconHits(block));
  }
  return out;
}

export function analyzeJobDescription(jdText: string): JdAnalysis {
  const thinking: string[] = [];
  const raw = jdText.replace(/\r/g, "").trim();
  const salaryHints = extractSalaryHints(raw);
  const companyHints = extractCompanyHints(raw);
  const text = stripJdNoise(raw);

  thinking.push("Structured JD parse: stripped salary/currency chrome; lexicon-first skills.");
  if (companyHints.length) thinking.push(`Company signals excluded from gaps: ${companyHints.slice(0, 3).join(", ")}.`);
  if (salaryHints.length) thinking.push(`Salary signals excluded: ${salaryHints.slice(0, 2).join(", ")}.`);

  const domain = detectDomain(text);
  thinking.push(`Detected JD domain: ${domain}.`);

  const titleHints = uniqueRanked(
    [...text.matchAll(ROLE_RE)].map((m) => m[1].trim()),
    companyHints,
    8,
  );
  const tools = uniqueRanked(extractLexiconHits(text), companyHints, 30);
  const mustHave = uniqueRanked(
    [...sectionTerms(text, "must"), ...tools.slice(0, 12)],
    companyHints,
    20,
  );
  const niceToHave = uniqueRanked(sectionTerms(text, "nice"), companyHints, 15);
  const softSkills = uniqueRanked(
    [...text.matchAll(
      /\b(communication|collaboration|ownership|problem[- ]solving|bias to action|curiosity|user-facing|end-to-end)\b/gi,
    )].map((m) => m[1]),
    companyHints,
    10,
  ).filter((s) => SOFT_WHITELIST.has(normalize(s)) || softSkillsKeep(s));

  // ATS keywords = tools + titles + soft whitelist ONLY (no raw keyword-extractor dump)
  const extractorCandidates = uniqueRanked(
    extractWithKeywordExtractor(text),
    companyHints,
    20,
  ).filter((k) => {
    const key = normalize(k);
    return (
      TECH_LEXICON.some((t) => normalize(t) === key) ||
      SOFT_WHITELIST.has(key) ||
      (k.includes(" ") && k.length >= 8 && !isNoiseKeyword(k, companyHints))
    );
  });

  const keywords = uniqueRanked(
    [...tools, ...titleHints, ...mustHave, ...softSkills, ...extractorCandidates, ...niceToHave],
    companyHints,
    28,
  ).filter((k, _i, arr) => {
    const nk = normalize(k);
    // Drop shorter subsumed terms (Engineer ⊂ Software Engineer, CSS ⊂ Tailwind CSS)
    return !arr.some((other) => {
      if (other === k) return false;
      const no = normalize(other);
      if (no === nk || no.length <= nk.length) return false;
      return (
        no.startsWith(`${nk} `) ||
        no.endsWith(` ${nk}`) ||
        no.includes(` ${nk} `)
      );
    });
  });

  thinking.push(`ATS keywords: ${keywords.slice(0, 12).join(", ") || "(none)"}.`);
  if (tools.length) thinking.push(`Tech stack: ${tools.slice(0, 10).join(", ")}.`);

  return {
    titleHints,
    mustHave,
    niceToHave,
    tools,
    softSkills,
    keywords,
    domain,
    companyHints,
    salaryHints,
    thinking,
  };
}

function softSkillsKeep(s: string): boolean {
  return /ownership|collaboration|communication|curiosity|user-facing|end-to-end|bias/i.test(s);
}

export function extractJdKeywords(jdText: string): string[] {
  return analyzeJobDescription(jdText).keywords;
}

/** Lightweight TF-IDF cosine similarity (no `natural` — avoids Vercel ESM crashes). */
export function tfidfSimilarity(resumeText: string, jdText: string): number {
  const tokenize = (t: string) =>
    removeStopwords(
      normalize(stripJdNoise(t))
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
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(?:^|[^a-z0-9+#./])${escaped}(?:[^a-z0-9+#./]|$)`).test(haystackNorm)) {
    return true;
  }
  const parts = n
    .split(" ")
    .filter((w) => w.length > 3 && !EXTRA_STOP.has(w) && !eng.includes(w));
  if (parts.length >= 2) {
    return parts.every((p) =>
      new RegExp(`(?:^|[^a-z0-9+#./])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9+#./]|$)`).test(
        haystackNorm,
      ),
    );
  }
  return false;
}

export function detectResumeDomain(resumeText: string): ResumeDomain {
  return detectDomain(resumeText);
}

export { TECH_LEXICON };

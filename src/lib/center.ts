/**
 * Vision-centering rewrite engine.
 * Always rewrites headline, summary, skill taxonomy, and bullet language toward the JD.
 * Never invents employers, degrees, metrics, or unearned tech.
 * Intensity scales by pivot distance: same | adjacent | hard.
 */
import {
  analyzeJobDescription,
  detectResumeDomain,
  normalize,
  pickBestTitle,
  termInText,
  type JdAnalysis,
  type ResumeDomain,
} from "@/lib/nlp";
import {
  resumeToPlainText,
  type StructuredResume,
} from "@/lib/schema";
import { capitalizeSentence, polishResume, titleCasePhrase } from "@/lib/resume/polish";

export type PivotDistance = "same" | "adjacent" | "hard";

/** User-selected rewrite strength (independent of auto-detected pivot distance). */
export type TailorIntensity = "subtle" | "medium" | "hard";

export const TAILOR_INTENSITY_META: Record<
  TailorIntensity,
  { label: string; blurb: string }
> = {
  subtle: {
    label: "Subtle",
    blurb: "Preserve structure. Keyword and ordering improvements.",
  },
  medium: {
    label: "Balanced",
    blurb: "Optimize for relevance. Adjust summary, skills, and bullets while keeping your voice.",
  },
  hard: {
    label: "Aggressive",
    blurb: "Maximum tailoring around the target role — still no invented experience.",
  },
};

type LexRule = { match: RegExp; to: string };

/** Honest phrase swaps that recenter language without inventing facts. */
const LEX: Record<string, LexRule[]> = {
  // support / BPO → product / tech-ops language
  support_to_tech: [
    {
      match: /\bhelped customers with complaints and support queries\s+related to\s+([^.]+)/gi,
      to: "triaged user issues related to $1; clarified requirements and drove resolution",
    },
    {
      match: /\bhelped customers with complaints and support queries/gi,
      to: "triaged user issues, clarified requirements, and drove resolution",
    },
    {
      match: /\bcoordinat(?:ed|ing) between customers and the technical team(?: so [^.]+)?/gi,
      to: "coordinated with technical teammates and users to close service requests on time",
    },
    {
      match: /\bcustomer care associate\b/gi,
      to: "customer-facing operations professional",
    },
    {
      match: /\bcustomer care (representative|associate|executive)\b/gi,
      to: "Customer Support $1",
    },
    {
      match: /\bvoice\s*\/\s*non-voice bpo\b/gi,
      to: "multi-channel support operations",
    },
    {
      match: /\binbound call\s*\/\s*chat\s*\/\s*email readiness\b/gi,
      to: "multi-channel user intake (call / chat / email)",
    },
    {
      match: /\bcustomer handling\s*&\s*complaint support\b/gi,
      to: "user-issue triage and resolution",
    },
    {
      match: /\bsla,\s*csat\s*&\s*quality \(qa\) mindset\b/gi,
      to: "SLA / CSAT / QA reliability mindset",
    },
    {
      match: /\bspoke with customers to understand their needs\b/gi,
      to: "ran user discovery conversations to confirm requirements and next steps",
    },
    {
      match: /\bcomplaint(s)?\b/gi,
      to: "issue$1",
    },
    {
      match: /\bpatients?\b/gi,
      to: "users",
    },
    {
      match: /\bhealthcare|hospital|clinic|medical\b/gi,
      to: "regulated / high-trust",
    },
  ],
  // software → AI / product-shipping language (only when facts allow)
  software_to_ai: [
    {
      match: /\bowned end-to-end delivery of\b/gi,
      to: "owned end-to-end delivery of",
    },
    {
      match: /\bengineered market-making bots and cli tools\b/gi,
      to: "built automated agent-style systems and CLI tools",
    },
    {
      match: /\bbuilt python automation\b/gi,
      to: "built Python automation pipelines",
    },
    {
      match: /\bshipped (erp and crm modules)\b/gi,
      to: "shipped user-facing $1",
    },
    {
      match: /\bturning businesses into strong online presences and working software products\b/gi,
      to: "shipping production software products and SaaS platforms end to end",
    },
  ],
};

function uniquePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = normalize(item);
    if (!key || seen.has(key)) continue;
    if ([...seen].some((s) => s.includes(key) && s !== key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function expandSkillItems(items: string[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    // Only explode on middot/bullet separators — never on commas inside a skill phrase
    if (/[•·]/.test(item) && item.length > 40) {
      const parts = item
        .split(/\s*[•·]\s*/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 100);
      if (parts.length > 1) {
        out.push(...parts);
        continue;
      }
    }
    out.push(item.trim().replace(/\s*\/\s*/g, " / "));
  }
  return uniquePreserve(out);
}

function dedupePhrase(text: string): string {
  const parts = text.split(/\s*[—–|·]\s*/).map((p) => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const p of parts) {
    const key = normalize(p);
    if (!key || seen.has(key)) continue;
    if (key.length <= 24 && [...seen].some((s) => s.includes(key))) continue;
    seen.add(key);
    kept.push(p);
  }
  return kept.join(" · ");
}

function applyLex(text: string, rules: LexRule[]): string {
  let out = text;
  for (const rule of rules) {
    out = out.replace(rule.match, rule.to);
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

/** Never mid-word slice — veteran resumes never end on "and fo." */
function truncateAtWord(text: string, max: number): string {
  const t = text.replace(/\s{2,}/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  const base = (sp > max * 0.55 ? cut.slice(0, sp) : cut).trim();
  return base.replace(/[,:;·|/&-]+$/, "").trim();
}

function cleanSentence(text: string): string {
  return text
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/\band,\s+/gi, "and ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
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

function isEng(d: ResumeDomain): boolean {
  return d === "software" || d === "ai";
}

function isSupportish(d: ResumeDomain): boolean {
  return d === "support" || d === "ops";
}

export function pivotDistance(
  resumeDomain: ResumeDomain,
  jdDomain: ResumeDomain,
): PivotDistance {
  if (resumeDomain === jdDomain) return "same";
  if (isEng(resumeDomain) && isEng(jdDomain)) return "adjacent"; // software ↔ ai
  if (isSupportish(resumeDomain) && isSupportish(jdDomain)) return "adjacent";
  if (isSupportish(resumeDomain) && isEng(jdDomain)) return "hard";
  if (isEng(resumeDomain) && isSupportish(jdDomain)) return "adjacent";
  if (resumeDomain === "general" || jdDomain === "general") return "adjacent";
  return "hard";
}

function pickLexPacks(
  resumeDomain: ResumeDomain,
  jdDomain: ResumeDomain,
  jdText: string,
): LexRule[] {
  const rules: LexRule[] = [];
  const techSupportJd =
    /saas|zendesk|freshdesk|servicenow|escalat|product knowledge|technical troubleshooting|software customer/i.test(
      jdText,
    );

  if (isSupportish(resumeDomain) && (isEng(jdDomain) || jdDomain === "ops" || techSupportJd)) {
    rules.push(...LEX.support_to_tech);
  }
  if (resumeDomain === "software" && jdDomain === "ai") {
    rules.push(...LEX.software_to_ai);
  }
  if (isSupportish(resumeDomain) && isSupportish(jdDomain)) {
    // Always soften raw BPO phrasing toward professional ops language
    rules.push(...LEX.support_to_tech);
  }
  return rules;
}

function extractJdThemes(jd: string, analysis: JdAnalysis): string[] {
  const themes: string[] = [];
  const n = normalize(jd);
  if (/end.to.end|own things|ownership/i.test(jd)) themes.push("end-to-end ownership");
  if (/agent|langchain|langgraph|llm|ai-native/i.test(jd)) themes.push("AI / agent systems");
  if (/ui\/?ux|user-facing|frontend|next\.js|react/i.test(jd)) themes.push("user-facing UI");
  if (/workflow|automation|human-in-the-loop/i.test(jd)) themes.push("workflow automation");
  if (/compliance|regulat|legal tech/i.test(jd)) themes.push("compliance / regulated domains");
  if (/ship|continuous deployment|production/i.test(jd)) themes.push("shipping to production");
  if (/document|extract|data handling/i.test(jd)) themes.push("document / data workflows");
  if (/sla|ticket|support|noc|incident/i.test(jd)) themes.push("ops reliability & triage");
  if (/bpo|customer|voice|non-voice/i.test(jd)) themes.push("customer operations");
  for (const t of analysis.titleHints.slice(0, 2)) themes.push(t);
  for (const t of analysis.tools.slice(0, 4)) {
    if (n.includes(normalize(t))) themes.push(t);
  }
  return uniquePreserve(themes).slice(0, 10);
}

function evidencedTools(resumeText: string, analysis: JdAnalysis): string[] {
  const n = normalize(resumeText);
  return analysis.tools.filter((t) => termInText(t, n));
}

function missingTools(resumeText: string, analysis: JdAnalysis): string[] {
  const n = normalize(resumeText);
  return analysis.tools.filter((t) => !termInText(t, n));
}

function buildHeadlineParts(
  analysis: JdAnalysis,
  distance: PivotDistance,
  evidenced: string[],
): string[] {
  const target = titleCasePhrase(pickBestTitle(analysis.titleHints, analysis.domain));

  if (distance === "hard") {
    return uniquePreserve([
      target,
      "User-Facing Problem Solver",
      "Cross-Functional Collaborator",
    ]);
  }

  const stack = evidenced.slice(0, 4);
  if (distance === "adjacent" && isEng(analysis.domain)) {
    return uniquePreserve([
      target,
      ...stack,
      analysis.domain === "ai" ? "Product-Minded Builder" : "Full-Stack Builder",
    ]);
  }

  const bits = [target, ...stack];
  if (analysis.softSkills.some((s) => /ownership|ship|bias/i.test(s))) {
    bits.push("Owns Delivery End To End");
  }
  return uniquePreserve(bits).slice(0, 5);
}

function buildHeadline(
  analysis: JdAnalysis,
  distance: PivotDistance,
  evidenced: string[],
): string {
  return buildHeadlineParts(analysis, distance, evidenced).join(" | ");
}

function buildSummary(
  resume: StructuredResume,
  analysis: JdAnalysis,
  distance: PivotDistance,
  themes: string[],
  evidenced: string[],
  transferables: string[],
  lex: LexRule[],
): string {
  const target = titleCasePhrase(pickBestTitle(analysis.titleHints, analysis.domain));
  const themeLine = themes
    .filter(
      (t) =>
        !/user-facing ui|typescript|python|react|next/i.test(t) ||
        evidenced.some((e) => normalize(e) === normalize(t)),
    )
    .slice(0, 3)
    .join("; ");
  const stackLine = evidenced.slice(0, 6).join(", ");

  if (distance === "hard") {
    const bgRaw = applyLex(resume.summary || "", lex)
      .replace(/eager to grow in[^.]*\./gi, "")
      .replace(/\bcustomer care associate with\b/gi, "")
      .replace(/\bcustomer-facing operations professional with\b/gi, "")
      .replace(/\bfollowing up politely\.?/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const bgSentence = truncateAtWord(
      cleanSentence(
        bgRaw
          .split(/(?<=[.!?])\s+/)
          .filter((s) => !/politely|eager to grow|voice\s*\/\s*non-voice/i.test(s))
          .slice(0, 2)
          .join(" ")
          .replace(/\band\s*$/i, "")
          .replace(/,\s*$/g, ""),
      ),
      200,
    );
    const strengthBits = transferables
      .slice(0, 3)
      .map((t) => t.replace(/^./, (c) => c.toLowerCase()));
    const body = [
      `${target} with hands-on user-facing operations experience clarifying requirements and delivering under SLA pressure.`,
      bgSentence ? capitalizeSentence(bgSentence.replace(/\.$/, "")) + "." : "",
      strengthBits.length ? `Strengths include ${strengthBits.join("; ")}.` : "",
      themeLine
        ? `Building toward ${/^[A-Z]{2,}/.test(themeLine) ? themeLine : themeLine.replace(/^./, (c) => c.toLowerCase())}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    return capitalizeSentence(cleanSentence(body)).slice(0, 700);
  }

  const sourceFacts = truncateAtWord(
    cleanSentence(
      applyLex(resume.summary || "", lex)
        .replace(/eager to grow in[^.]*\./gi, "")
        .replace(/voice\s*\/\s*non-voice bpo[^.]*\./gi, "")
        .replace(/^full stack software developer with /i, "")
        .replace(/^aspiring[^.]*\.\s*/i, "")
        .replace(/^customer care associate with /i, "Background in ")
        .replace(/\s{2,}/g, " ")
        .trim(),
    ),
    280,
  );

  const opener =
    analysis.domain === "ai"
      ? `${target} who ships production software and is actively building toward AI-native product work.`
      : analysis.domain === "support"
        ? `${target} focused on reliable, multi-channel user operations and SLA-grade delivery.`
        : `${target} who owns features end to end — from vague problem to shipped production.`;

  return capitalizeSentence(
    cleanSentence(
      [
        opener,
        sourceFacts ? capitalizeSentence(sourceFacts.replace(/\.$/, "")) + "." : "",
        stackLine ? `Evidence stack: ${stackLine}.` : "",
        themeLine ? `Centered on this role's themes: ${themeLine}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    ),
  ).slice(0, 700);
}

function collectTransferables(text: string): string[] {
  const labels: { re: RegExp; label: string }[] = [
    { re: /customer|complaint|support|inbound|user|chat|call/i, label: "User-facing problem solving" },
    { re: /sla|csat|qa|quality|reliability/i, label: "Quality & reliability mindset" },
    { re: /coordinat|technical team|cross-functional|stakeholder/i, label: "Cross-functional collaboration" },
    { re: /ticket|crm|document|excel|word|data entry|sop/i, label: "Structured documentation & tooling" },
    { re: /ship|production|deploy|vercel|docker/i, label: "Production delivery" },
    { re: /automation|bot|pipeline|agent/i, label: "Automation & tooling" },
    // Never invent UI craft from JD alone — only if resume already shows UI work
    { re: /\b(react|next\.?js|frontend|ui\/ux|figma|css|html)\b/i, label: "Frontend / UI" },
  ];
  return uniquePreserve(
    labels.filter((l) => l.re.test(text)).map((l) => l.label),
  );
}

function rewriteBullet(bullet: string, lex: LexRule[], keywords: string[]): string {
  let b = applyLex(dedupePhrase(bullet), lex);
  if (/end.to.end|own/i.test(keywords.join(" ")) && /shipped|built|owned/i.test(b)) {
    b = b.replace(/^(shipped|built)\b/i, "Owned and $1");
  }
  b = cleanSentence(b);
  if (b && /^[a-z]/.test(b)) b = capitalize(b);
  b = b.replace(/^Owned and [Oo]wned\b/, "Owned");
  // Fix lex artifacts when source bullet was truncated mid-list ("..., and" → ", and, clarified")
  b = b.replace(/,\s*and,\s*/gi, ", and ").replace(/\sand,\s+clarified/gi, " and clarified");
  return b;
}

function classifySkill(item: string): string {
  const n = normalize(item);
  if (/^(javascript|typescript|python|sql|go|rust|java|c\+\+|c#)$/.test(n)) {
    return "Languages";
  }
  if (/react|next|tailwind|css|html|zod|pwa|vue|angular|frontend|ui|ux/.test(n)) {
    return "Frontend / UI";
  }
  if (
    /node|api|prisma|drizzle|auth|rbac|postgres|mongo|neo4j|backend|rest|graphql|orm/.test(
      n,
    )
  ) {
    return "Backend / Data";
  }
  if (/docker|vercel|vps|git|sentry|ci|cd|deploy|devops|actions|kubernetes/.test(n)) {
    return "DevOps / Delivery";
  }
  if (/langchain|langgraph|openai|anthropic|llm|rag|agent/.test(n)) {
    return "AI / Agents";
  }
  if (/sla|csat|qa|sop|ticket|crm|zendesk|freshdesk|quality|reliability/.test(n)) {
    return "Quality / Ops";
  }
  if (/customer|inbound|chat|call|email|complaint|support|handling|triage|user-issue|multi-channel/.test(n)) {
    return "Customer Operations";
  }
  if (/excel|word|ms office|documentation/.test(n)) {
    return "Applications";
  }
  return "Additional Skills";
}

function isLowSignalTool(item: string): boolean {
  return /^(basic computer operations|computer operations|ms office basics|typing)$/i.test(
    item.trim(),
  );
}

function regroupSkills(
  resume: StructuredResume,
  analysis: JdAnalysis,
  distance: PivotDistance,
  evidenced: string[],
  transferables: string[],
  keywords: string[],
  lex: LexRule[],
): StructuredResume["skills"] {
  const allItems = expandSkillItems(resume.skills.flatMap((g) => g.items))
    .map((i) => applyLex(i, lex))
    .filter((i) => !isLowSignalTool(i));

  if (distance === "hard") {
    // Veteran pattern (FAANG / late-stage startup ATS): one competencies line + real tools.
    // Never use coach-speak labels like "Transferable Strengths" / "Tools Already Used".
    const competencies = uniquePreserve([
      // Prefer concrete reframed skills first; abstract strengths fill remaining slots
      ...allItems
        .filter((i) => !/\b(excel|word|ms office|crm|zendesk|freshdesk|jira|git)\b/i.test(i))
        .slice(0, 8),
      ...transferables.slice(0, 4),
    ]).slice(0, 10);

    const applications = uniquePreserve([
      ...evidenced,
      ...allItems.filter((i) => /\b(excel|word|ms office|crm|zendesk|freshdesk|jira|git)\b/i.test(i)),
    ])
      .filter((i) => !isLowSignalTool(i))
      .slice(0, 8);

    return [
      { category: "Core Competencies", items: competencies },
      ...(applications.length
        ? [{ category: "Applications", items: applications }]
        : []),
    ].filter((g) => g.items.length > 0);
  }

  // same / adjacent: taxonomy buckets, JD-ordered inside each bucket
  const buckets = new Map<string, string[]>();
  const order = [
    "Languages",
    "Frontend / UI",
    "Backend / Data",
    "AI / Agents",
    "DevOps / Delivery",
    "Customer Operations",
    "Quality / Ops",
    "Applications",
    "Additional Skills",
  ];
  for (const item of allItems) {
    const cat = classifySkill(item);
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(item);
  }

  const groups: StructuredResume["skills"] = [];
  for (const cat of order) {
    const items = buckets.get(cat);
    if (!items?.length) continue;
    const sorted = uniquePreserve(
      [...items].sort((a, b) => overlapScore(b, keywords) - overlapScore(a, keywords)),
    );
    groups.push({ category: cat, items: sorted });
  }

  if (!groups.length && allItems.length) {
    return [{ category: "Core Skills", items: allItems.slice(0, 16) }];
  }
  return groups;
}

function rewriteProjects(
  resume: StructuredResume,
  lex: LexRule[],
  keywords: string[],
): StructuredResume["projects"] {
  return [...resume.projects]
    .map((p) => ({
      ...p,
      name: dedupePhrase(p.name),
      bullets: uniquePreserve(p.bullets.map((b) => rewriteBullet(b, lex, keywords))),
    }))
    .sort(
      (a, b) =>
        overlapScore(`${a.name} ${a.bullets.join(" ")}`, keywords) -
        overlapScore(`${b.name} ${b.bullets.join(" ")}`, keywords),
    )
    .reverse();
}

/**
 * Main centering entry.
 * `intensity` controls how aggressive the rewrite is (user choice).
 * Auto-detected `distance` still informs hard-mode framing.
 */
export function centerResumeForJd(
  resume: StructuredResume,
  jobDescription: string,
  analysis?: JdAnalysis,
  intensity: TailorIntensity = "medium",
): {
  resume: StructuredResume;
  thinking: string[];
  analysis: JdAnalysis;
  distance: PivotDistance;
  intensity: TailorIntensity;
  headlineParts: string[];
} {
  const analyzed = analysis ?? analyzeJobDescription(jobDescription);
  const thinking = [...analyzed.thinking];
  const sourceText = resumeToPlainText(resume);
  const resumeDomain = detectResumeDomain(sourceText);
  const distance = pivotDistance(resumeDomain, analyzed.domain);
  const themes = extractJdThemes(jobDescription, analyzed);
  const evidenced = evidencedTools(sourceText, analyzed);
  const missing = missingTools(sourceText, analyzed);
  const lex = pickLexPacks(resumeDomain, analyzed.domain, jobDescription);
  const transferables = collectTransferables(sourceText);
  const keywords = analyzed.keywords;

  thinking.push(`Intensity: ${intensity} (${TAILOR_INTENSITY_META[intensity].label}).`);
  thinking.push(`Resume domain: ${resumeDomain}. JD domain: ${analyzed.domain}.`);
  thinking.push(`Auto pivot distance: ${distance}.`);
  thinking.push(`JD themes: ${themes.slice(0, 6).join("; ") || "(general)"}.`);
  if (evidenced.length) thinking.push(`Evidenced stack: ${evidenced.slice(0, 8).join(", ")}.`);
  if (missing.length) thinking.push(`Honest gaps (not invented): ${missing.slice(0, 8).join(", ")}.`);

  const next = cleanContact(structuredClone(resume));

  if (intensity === "subtle") {
    applySubtle(next, analyzed, keywords, evidenced, themes, thinking);
    const polished = polishResume(next);
    const headlineParts = polished.headline
      ? polished.headline.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean)
      : [];
    return { resume: polished, thinking, analysis: analyzed, distance, intensity, headlineParts };
  }

  if (intensity === "medium") {
    const framing: PivotDistance = distance === "hard" ? "adjacent" : distance;
    const mildLex = lex.filter(
      (r) =>
        !/complaint|patients?|healthcare|hospital|clinic|medical/i.test(r.match.source) ||
        /helped customers|coordinat|voice|inbound|customer handling|customer care/i.test(
          r.match.source,
        ),
    );
    const headlineParts = applyMedium(next, analyzed, framing, themes, evidenced, missing, transferables, mildLex, keywords, resumeDomain, thinking);
    const polishedMed = polishResume(next);
    const medParts = polishedMed.headline
      ? polishedMed.headline.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean)
      : headlineParts;
    return { resume: polishedMed, thinking, analysis: analyzed, distance, intensity, headlineParts: medParts };
  }

  applyHard(next, analyzed, distance, themes, evidenced, missing, transferables, lex, keywords, resumeDomain, thinking);
  const polishedHard = polishResume(next);
  const hardParts = polishedHard.headline
    ? polishedHard.headline.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean)
    : [];
  return { resume: polishedHard, thinking, analysis: analyzed, distance, intensity, headlineParts: hardParts };
}

function cleanContact(resume: StructuredResume): StructuredResume {
  resume.contact = {
    ...resume.contact,
    fullName: dedupePhrase(resume.contact.fullName),
    email: resume.contact.email.trim(),
    phone: resume.contact.phone.trim(),
    location: resume.contact.location
      ? dedupePhrase(
          resume.contact.location
            .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
            .replace(/(?:\+?\d[\d\s-]{7,}\d)/g, "")
            .trim(),
        )
      : resume.contact.location,
    links: [...resume.contact.links],
  };
  if (resume.extras?.length) {
    resume.extras = resume.extras.filter(
      (e) => !/age:|nationality:|personal details|target roles|key strengths/i.test(e),
    );
    if (!resume.extras.length) delete resume.extras;
  }
  return resume;
}

function sortByKeywords<T>(items: T[], textOf: (item: T) => string, keywords: string[]): T[] {
  return [...items].sort(
    (a, b) => overlapScore(textOf(b), keywords) - overlapScore(textOf(a), keywords),
  );
}

/** Subtle: promote evidenced keywords + reorder. Keep original wording. */
function applySubtle(
  next: StructuredResume,
  analyzed: JdAnalysis,
  keywords: string[],
  evidenced: string[],
  themes: string[],
  thinking: string[],
) {
  const existing = new Set(
    expandSkillItems(next.skills.flatMap((g) => g.items)).map((i) => normalize(i)),
  );
  const toPromote = evidenced.filter((t) => !existing.has(normalize(t)));

  if (toPromote.length) {
    const core = next.skills[0] || { category: "Core Skills", items: [] };
    core.items = uniquePreserve([...toPromote, ...core.items]);
    if (!next.skills.length) next.skills = [core];
    else next.skills[0] = core;
    thinking.push(`Subtle: promoted evidenced JD keywords into skills: ${toPromote.slice(0, 6).join(", ")}.`);
  } else {
    thinking.push("Subtle: no new evidenced keywords to promote — reordering only.");
  }

  next.skills = next.skills.map((g) => ({
    ...g,
    items: [...g.items].sort((a, b) => overlapScore(b, keywords) - overlapScore(a, keywords)),
  }));

  // Light headline fill if empty
  if (!next.headline.trim() && analyzed.titleHints.length) {
    const hint = analyzed.titleHints[0];
    if (evidenced.length || overlapScore(resumeToPlainText(next), [hint]) > 0) {
      next.headline = uniquePreserve([hint, ...evidenced.slice(0, 3)]).join(" | ");
      thinking.push(`Subtle: filled empty headline from JD title + evidenced stack.`);
    }
  }

  // Optional one-line theme nudge at end of summary (not a rewrite)
  if (themes.length && next.summary && !normalize(next.summary).includes(normalize(themes[0]))) {
    const nudge = `Keywords emphasized for this role: ${evidenced.slice(0, 4).join(", ") || themes.slice(0, 3).join(", ")}.`;
    if (evidenced.length && next.summary.length < 650) {
      next.summary = `${next.summary.replace(/\s+$/, "")} ${nudge}`.slice(0, 780);
      thinking.push("Subtle: appended evidenced keyword emphasis line to summary.");
    }
  }

  next.experience = sortByKeywords(
    next.experience.map((job) => ({
      ...job,
      bullets: [...job.bullets].sort(
        (a, b) => overlapScore(b, keywords) - overlapScore(a, keywords),
      ),
    })),
    (j) => `${j.title} ${j.company} ${j.bullets.join(" ")}`,
    keywords,
  );

  next.projects = sortByKeywords(
    next.projects,
    (p) => `${p.name} ${p.bullets.join(" ")}`,
    keywords,
  );

  thinking.push("Subtle complete: wording preserved; skills/experience reordered for ATS overlap.");
}

/** Medium: mild reframes, no hard-pivot transferables swap. */
function applyMedium(
  next: StructuredResume,
  analyzed: JdAnalysis,
  framing: PivotDistance,
  themes: string[],
  evidenced: string[],
  missing: string[],
  transferables: string[],
  lex: LexRule[],
  keywords: string[],
  resumeDomain: ResumeDomain,
  thinking: string[],
): string[] {
  const headlineParts = buildHeadlineParts(analyzed, framing === "hard" ? "adjacent" : framing, evidenced);
  next.headline = headlineParts.join(" | ");

  let summary = applyLex(next.summary || "", lex)
    .replace(/eager to grow in[^.]*\./gi, "")
    .replace(/voice\s*\/\s*non-voice bpo[^.]*\./gi, "")
    .trim();
  if (themes.length) {
    summary = `${summary} Centered toward: ${themes.slice(0, 3).join("; ")}.`.replace(/\s{2,}/g, " ");
  }
  if (evidenced.length) {
    summary = `${summary} Evidence stack: ${evidenced.slice(0, 5).join(", ")}.`;
  }
  next.summary = truncateAtWord(cleanSentence(summary), 700);

  next.skills = regroupSkills(
    next,
    analyzed,
    framing === "hard" ? "adjacent" : framing,
    evidenced,
    transferables,
    keywords,
    lex,
  );

  next.experience = sortByKeywords(
    next.experience.map((job) => {
      const loc = job.location ? dedupePhrase(job.location) : job.location;
      const covered =
        loc &&
        next.contact.location &&
        normalize(next.contact.location).includes(normalize(loc));
      return {
        ...job,
        company: dedupePhrase(job.company),
        title: dedupePhrase(job.title),
        location: covered ? undefined : loc,
        bullets: uniquePreserve(
          job.bullets.map((b) => rewriteBullet(b, lex, keywords)),
        ).filter(Boolean),
      };
    }),
    (j) => `${j.title} ${j.company} ${j.bullets.join(" ")}`,
    keywords,
  );

  next.projects = rewriteProjects(next, lex, keywords);
  next.education = next.education.map((e) => ({
    ...e,
    school: dedupePhrase(e.school),
    degree: dedupePhrase(e.degree),
    details: e.details ? dedupePhrase(e.details) : e.details,
  }));

  thinking.push(
    framing === "adjacent" && resumeDomain === "support"
      ? "Medium: mild ops→tech language reframes; kept original career identity (no hard pivot)."
      : "Medium: mild headline/summary/bullet updates + JD-ranked skills.",
  );
  if (missing.length) thinking.push(`Gaps for ATS UI only: ${missing.slice(0, 6).join(", ")}.`);
  return headlineParts;
}

/** Hard: full vision pivot including BPO→SWE transferables framing. */
function applyHard(
  next: StructuredResume,
  analyzed: JdAnalysis,
  distance: PivotDistance,
  themes: string[],
  evidenced: string[],
  missing: string[],
  transferables: string[],
  lex: LexRule[],
  keywords: string[],
  resumeDomain: ResumeDomain,
  thinking: string[],
): string[] {
  const headlineParts = buildHeadlineParts(analyzed, distance, evidenced);
  next.headline = headlineParts.join(" | ");
  next.summary = buildSummary(
    next,
    analyzed,
    distance,
    themes,
    evidenced,
    transferables,
    lex,
  );
  next.skills = regroupSkills(
    next,
    analyzed,
    distance,
    evidenced,
    transferables,
    keywords,
    lex,
  );

  next.experience = sortByKeywords(
    next.experience.map((job) => {
      const loc = job.location ? dedupePhrase(job.location) : job.location;
      const covered =
        loc &&
        next.contact.location &&
        normalize(next.contact.location).includes(normalize(loc));
      return {
        ...job,
        company: dedupePhrase(job.company),
        title: dedupePhrase(
          distance === "hard" && isSupportish(resumeDomain)
            ? applyLex(job.title, LEX.support_to_tech)
            : job.title,
        ),
        location: covered ? undefined : loc,
        bullets: uniquePreserve(
          job.bullets.map((b) => rewriteBullet(b, lex, keywords)),
        ).filter(Boolean),
      };
    }),
    (j) => `${j.title} ${j.company} ${j.bullets.join(" ")}`,
    keywords,
  );

  next.projects = rewriteProjects(next, lex, keywords);
  next.education = next.education.map((e) => ({
    ...e,
    school: dedupePhrase(e.school),
    degree: dedupePhrase(e.degree),
    details: e.details ? dedupePhrase(e.details) : e.details,
  }));

  thinking.push(
    distance === "hard"
      ? "Hard: vision pivot with Core Competencies / Applications taxonomy (no coach-speak labels; gaps only in ATS UI)."
      : distance === "adjacent"
        ? "Hard intensity on adjacent domains: aggressive retargeting of headline/summary/skills/bullets."
        : "Hard intensity on same domain: full vision-centering rewrite toward JD.",
  );
  if (missing.length) thinking.push(`Gaps for ATS UI only: ${missing.slice(0, 6).join(", ")}.`);
  return headlineParts;
}

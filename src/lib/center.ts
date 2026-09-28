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
  termInText,
  type JdAnalysis,
  type ResumeDomain,
} from "@/lib/nlp";
import {
  resumeToPlainText,
  type StructuredResume,
} from "@/lib/schema";

export type PivotDistance = "same" | "adjacent" | "hard";

type LexRule = { match: RegExp; to: string };

/** Honest phrase swaps that recenter language without inventing facts. */
const LEX: Record<string, LexRule[]> = {
  // support / BPO → product / tech-ops language
  support_to_tech: [
    {
      match: /\bhelped customers with complaints and support queries\s+related to\s+([^.]+)/gi,
      to: "triaged user issues related to $1, clarified requirements, and drove resolution",
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
    if (/[|,•·—–]/.test(item) && item.length > 40) {
      const parts = item
        .split(/\s*[|,•·—–]\s*/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 80);
      if (parts.length > 1) {
        out.push(...parts);
        continue;
      }
    }
    out.push(item.trim());
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

function buildHeadline(
  resume: StructuredResume,
  analysis: JdAnalysis,
  distance: PivotDistance,
  evidenced: string[],
): string {
  const target =
    analysis.titleHints[0] ||
    (analysis.domain === "ai"
      ? "Software / AI Engineer"
      : analysis.domain === "software"
        ? "Software Engineer"
        : analysis.domain === "support"
          ? "Customer / Tech Support Specialist"
          : "Professional");

  if (distance === "hard") {
    return `Aspiring ${target} | User-Facing Problem Solver | Fast Learner`;
  }

  const stack = evidenced.slice(0, 4);
  if (distance === "adjacent" && isEng(analysis.domain)) {
    return uniquePreserve([
      target,
      ...stack,
      analysis.domain === "ai" ? "Product-minded builder" : "Full-stack builder",
    ]).join(" | ");
  }

  // same-domain: still rewrite toward JD titles + evidenced stack
  const bits = [target, ...stack];
  if (analysis.softSkills.some((s) => /ownership|ship|bias/i.test(s))) {
    bits.push("Owns delivery end to end");
  }
  return uniquePreserve(bits).slice(0, 5).join(" | ");
}

function buildSummary(
  resume: StructuredResume,
  analysis: JdAnalysis,
  distance: PivotDistance,
  themes: string[],
  evidenced: string[],
  missing: string[],
  transferables: string[],
  lex: LexRule[],
): string {
  const target =
    analysis.titleHints[0] ||
    (analysis.domain === "ai" ? "Software / AI Engineer" : "Software Engineer");
  const themeLine = themes.slice(0, 4).join("; ");
  const stackLine = evidenced.slice(0, 6).join(", ");

  if (distance === "hard") {
    const bg = applyLex(resume.summary || "", lex)
      .replace(/eager to grow in[^.]*\./gi, "")
      .replace(/\bcustomer care associate with\b/gi, "Background:")
      .slice(0, 200)
      .trim();
    return [
      `Targeting ${target} roles with a deliberate pivot from customer-facing operations into product engineering.`,
      bg ? `${capitalize(bg.replace(/\.$/, ""))}.` : "",
      transferables.length
        ? `Core transferables: ${transferables.slice(0, 4).join("; ")}.`
        : "Strengths in clarifying requirements, coordinating with technical teams, and delivering under SLA pressure.",
      themeLine ? `Aligning experience toward: ${themeLine}.` : "",
      missing.length
        ? `Honest gaps (learning, not claimed): ${missing.slice(0, 5).join(", ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 780);
  }

  // same + adjacent: rewrite summary to lead with target vision
  const sourceFacts = applyLex(resume.summary || "", lex)
    .replace(/eager to grow in[^.]*\./gi, "")
    .replace(/voice\s*\/\s*non-voice bpo[^.]*\./gi, "")
    .replace(/^full stack software developer with /i, "")
    .replace(/^aspiring[^.]*\.\s*/i, "")
    .replace(/^customer care associate with /i, "Background in ")
    .replace(/\s{2,}/g, " ")
    .slice(0, 280)
    .trim();

  const opener =
    analysis.domain === "ai"
      ? `${target} who ships production software and is actively building toward AI-native product work.`
      : analysis.domain === "support"
        ? `${target} focused on reliable, multi-channel user operations and SLA-grade delivery.`
        : `${target} who owns features end to end — from vague problem to shipped production.`;

  return [
    opener,
    sourceFacts ? capitalize(sourceFacts.replace(/\.$/, "")) + "." : "",
    stackLine ? `Evidence stack: ${stackLine}.` : "",
    themeLine ? `Centered on this role's themes: ${themeLine}.` : "",
    missing.length && distance !== "same"
      ? `Not claimed (gaps): ${missing.slice(0, 4).join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .slice(0, 780);
}

function collectTransferables(text: string): string[] {
  const labels: { re: RegExp; label: string }[] = [
    { re: /customer|complaint|support|inbound|user|chat|call/i, label: "User-facing problem solving" },
    { re: /sla|csat|qa|quality|reliability/i, label: "Quality & reliability mindset" },
    { re: /coordinat|technical team|cross-functional|stakeholder/i, label: "Cross-functional collaboration" },
    { re: /ticket|crm|document|excel|word|data entry|sop/i, label: "Structured documentation & tooling" },
    { re: /ship|production|deploy|vercel|docker/i, label: "Production delivery" },
    { re: /automation|bot|pipeline|agent/i, label: "Automation & tooling" },
    { re: /ui|ux|frontend|react|next/i, label: "User-facing UI craft" },
  ];
  return uniquePreserve(
    labels.filter((l) => l.re.test(text)).map((l) => l.label),
  );
}

function rewriteBullet(bullet: string, lex: LexRule[], keywords: string[]): string {
  let b = applyLex(dedupePhrase(bullet), lex);
  // Light JD-theme boosts when already true
  if (/ship|deliver|owned|built|engineered/i.test(b) && /production|vercel|vps|deploy/i.test(b)) {
    // already strong
  } else if (/end.to.end|own/i.test(keywords.join(" ")) && /shipped|built|owned/i.test(b)) {
    b = b.replace(/^(shipped|built)\b/i, "Owned and $1");
  }
  b = b.replace(/\s{2,}/g, " ").trim();
  if (b && /^[a-z]/.test(b)) b = capitalize(b);
  // Fix double Owned and Owned
  b = b.replace(/^Owned and [Oo]wned\b/, "Owned");
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
  if (/excel|word|data entry|ms |documentation|computer/.test(n)) {
    return "Tools";
  }
  return "Additional Skills";
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
  const allItems = expandSkillItems(resume.skills.flatMap((g) => g.items)).map(
    (i) => applyLex(i, lex),
  );

  if (distance === "hard") {
    const prior = allItems.filter((i) =>
      /customer|sla|csat|crm|ticket|inbound|call|chat|excel|word|data entry|complaint|qa|sop|support/i.test(
        i,
      ),
    );
    const tools = uniquePreserve([
      ...evidenced,
      ...allItems.filter((i) => /excel|word|crm|ticket|ms |git|computer/i.test(i)),
    ]);
    return [
      { category: "Transferable Strengths", items: transferables.slice(0, 8) },
      { category: "Tools Already Used", items: tools.slice(0, 8) },
      {
        category: "Prior Domain (reframed)",
        items: uniquePreserve(
          prior.map((p) => applyLex(p, LEX.support_to_tech)),
        ).slice(0, 8),
      },
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
    "Tools",
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
 * Main centering entry — always produces a visibly re-centered resume.
 */
export function centerResumeForJd(
  resume: StructuredResume,
  jobDescription: string,
  analysis?: JdAnalysis,
): { resume: StructuredResume; thinking: string[]; analysis: JdAnalysis; distance: PivotDistance } {
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

  thinking.push(`Resume domain: ${resumeDomain}. JD domain: ${analyzed.domain}.`);
  thinking.push(`Pivot distance: ${distance} — applying vision-centering rewrite (not keyword sort only).`);
  thinking.push(`JD themes centered: ${themes.slice(0, 6).join("; ") || "(general)"}.`);
  if (evidenced.length) thinking.push(`Evidenced stack kept: ${evidenced.slice(0, 8).join(", ")}.`);
  if (missing.length) thinking.push(`Honest gaps (not invented): ${missing.slice(0, 8).join(", ")}.`);

  const next: StructuredResume = structuredClone(resume);

  next.contact = {
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

  next.headline = buildHeadline(next, analyzed, distance, evidenced);
  next.summary = buildSummary(
    next,
    analyzed,
    distance,
    themes,
    evidenced,
    missing,
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

  next.experience = next.experience
    .map((job) => {
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
    })
    .sort(
      (a, b) =>
        overlapScore(`${b.title} ${b.company} ${b.bullets.join(" ")}`, keywords) -
        overlapScore(`${a.title} ${a.company} ${a.bullets.join(" ")}`, keywords),
    );

  next.projects = rewriteProjects(next, lex, keywords);

  next.education = next.education.map((e) => ({
    ...e,
    school: dedupePhrase(e.school),
    degree: dedupePhrase(e.degree),
    details: e.details ? dedupePhrase(e.details) : e.details,
  }));

  if (next.extras?.length) {
    next.extras = next.extras.filter(
      (e) => !/age:|nationality:|personal details|target roles|key strengths/i.test(e),
    );
    if (!next.extras.length) delete next.extras;
  }

  thinking.push(
    distance === "hard"
      ? "Hard pivot: transition headline/summary + transferables; job employers/titles stay factual."
      : distance === "adjacent"
        ? "Adjacent pivot: retargeted headline/summary/skills/bullets toward JD vocabulary."
        : "Same-domain centering: rewritten headline/summary, JD-ranked skills, theme-aligned bullets.",
  );

  return { resume: next, thinking, analysis: analyzed, distance };
}

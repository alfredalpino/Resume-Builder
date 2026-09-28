import {
  analyzeJobDescription,
  detectResumeDomain,
  normalize,
  type JdAnalysis,
  type ResumeDomain,
} from "@/lib/nlp";
import {
  resumeToPlainText,
  type StructuredResume,
} from "@/lib/schema";

/** Map support/BPO language → product/engineering-adjacent phrasing (truthful only). */
const TRANSFER_MAP: { match: RegExp; label: string; rewriteHint: string }[] = [
  {
    match: /customer|complaint|support|inbound|call|chat/i,
    label: "User-facing problem solving",
    rewriteHint: "clarified user needs and resolved issues with clear follow-up",
  },
  {
    match: /sla|csat|qa|quality/i,
    label: "Quality & reliability mindset",
    rewriteHint: "worked to SLA/CSAT quality standards with documented outcomes",
  },
  {
    match: /technical team|field|coordinat/i,
    label: "Cross-functional collaboration",
    rewriteHint: "coordinated with technical teams to close requests on time",
  },
  {
    match: /ticket|crm|document|excel|word|data entry/i,
    label: "Structured documentation & tools",
    rewriteHint: "tracked work in CRM/ticketing tools and kept clear documentation",
  },
  {
    match: /learn|adapt|multitask|pressure/i,
    label: "Learning velocity under pressure",
    rewriteHint: "adapted quickly and delivered under production pressure",
  },
  {
    match: /quotation|follow-?up|stakeholder/i,
    label: "Requirements clarification",
    rewriteHint: "gathered requirements, shared options, and followed up with stakeholders",
  },
];

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
    // Drop fragments already covered by a longer item
    if ([...seen].some((s) => s.includes(key) && s !== key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function expandSkillItems(items: string[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (/[|,•·—–]/.test(item) || item.length > 55) {
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

function stripCorruption(text: string): string {
  return text
    .replace(/\s*Core strengths aligned to this role include[^.]*\.?/gi, "")
    .replace(/,?\s*applying\s+[A-Z][^.]{0,60}\./gi, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
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

function isEngineeringDomain(d: ResumeDomain): boolean {
  return d === "software" || d === "ai";
}

function collectTransferables(resume: StructuredResume): string[] {
  const blob = resumeToPlainText(resume);
  const labels: string[] = [];
  for (const rule of TRANSFER_MAP) {
    if (rule.match.test(blob)) labels.push(rule.label);
  }
  return uniquePreserve(labels);
}

function reframeBullet(bullet: string): string {
  let b = stripCorruption(dedupePhrase(bullet)).replace(/\s+/g, " ").trim();

  b = b.replace(
    /coordinat(?:ed|ing) between customers and the technical team(?:\s+so\s+[^.]*)?/gi,
    "coordinated with technical teammates and customers to close service requests on time",
  );
  b = b.replace(
    /helped customers with complaints and support queries(?:\s+related to[^.]+)?/gi,
    "triaged customer issues, clarified requirements, and drove resolution",
  );
  b = b.replace(
    /spoke with customers to understand their needs(?:\s+and[^.]*)?/gi,
    "ran user conversations to understand needs and confirm next steps",
  );
  b = b.replace(
    /eager to grow in voice\s*\/\s*non-voice bpo roles[^.]*\.?/gi,
    "",
  );

  // Capitalize first letter; drop trailing junk
  b = b.replace(/\s{2,}/g, " ").replace(/\s+\./g, ".").trim();
  if (b && /^[a-z]/.test(b)) b = b[0].toUpperCase() + b.slice(1);
  return b;
}

function buildTransitionSummary(
  resume: StructuredResume,
  analysis: JdAnalysis,
  transferables: string[],
): string {
  const target =
    analysis.titleHints[0] ||
    (analysis.domain === "ai" ? "AI / Software Engineer" : "Software Engineer");
  const tools = analysis.tools.slice(0, 5).join(", ");
  const transfer =
    transferables.length > 0
      ? transferables.slice(0, 4).join("; ")
      : "clear communication, documentation, and ownership under pressure";

  // Keep one factual background clause without leading on BPO job titles
  const background = stripCorruption(resume.summary)
    .replace(/Eager to grow in Voice\s*\/\s*Non-Voice BPO roles[^.]*\.?/gi, "")
    .replace(/\bCustomer care associate with\b/gi, "Background in")
    .replace(/\bCustomer Care (Representative|Associate|Executive)\b/gi, "customer-facing operations")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 220);

  const parts = [
    `Aspiring ${target} transitioning from customer-facing operations.`,
    background
      ? `${background.replace(/\.$/, "")}.`
      : "Hands-on experience clarifying user needs and coordinating with technical teams.",
    `Transferable strengths: ${transfer}.`,
    tools
      ? `Actively learning toward ${tools}; skills below list only what is already evidenced — no invented stack.`
      : "Claims limited to evidenced experience; technical gaps called out honestly.",
  ];

  return parts.join(" ").replace(/\s{2,}/g, " ").trim().slice(0, 700);
}

/**
 * Smart Thinking tailor with honest career-pivot support.
 * Never invents employers, degrees, or unearned tech skills.
 */
export function tailorResumeSmart(
  resume: StructuredResume,
  jobDescription: string,
  analysis?: JdAnalysis,
): { resume: StructuredResume; thinking: string[]; analysis: JdAnalysis } {
  const analyzed = analysis ?? analyzeJobDescription(jobDescription);
  const thinking = [...analyzed.thinking];
  const keywords = analyzed.keywords;
  const sourceText = resumeToPlainText(resume);
  const resumeDomain = detectResumeDomain(sourceText);
  thinking.push(`Detected resume domain: ${resumeDomain}.`);

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
            .replace(/\s{2,}/g, " ")
            .trim(),
        )
      : resume.contact.location,
    links: [...resume.contact.links],
  };

  next.summary = stripCorruption(next.summary);
  next.headline = stripCorruption(next.headline);
  next.experience = next.experience.map((job) => {
    const loc = job.location ? dedupePhrase(job.location) : job.location;
    // Avoid repeating city under every job when contact already covers it
    const coveredByContact =
      loc &&
      next.contact.location &&
      (normalize(next.contact.location).includes(normalize(loc)) ||
        normalize(loc) === normalize(next.contact.location));
    return {
      ...job,
      company: dedupePhrase(job.company),
      title: dedupePhrase(job.title),
      location: coveredByContact ? undefined : loc,
      bullets: uniquePreserve(job.bullets.map(reframeBullet)).filter(Boolean),
    };
  });
  next.education = next.education.map((e) => ({
    ...e,
    school: dedupePhrase(e.school),
    degree: dedupePhrase(e.degree),
    details: e.details ? dedupePhrase(e.details) : e.details,
  }));
  next.skills = next.skills
    .map((g) => ({
      ...g,
      items: expandSkillItems(g.items).filter(
        (item) =>
          !/^(not|help|fast|customers|all|know|do|care|it|support|focus)$/i.test(
            item.trim(),
          ),
      ),
    }))
    .filter((g) => g.items.length > 0);

  if (next.extras?.length) {
    next.extras = next.extras.filter(
      (e) =>
        !/age:|nationality:|location:|personal details|target roles|key strengths/i.test(
          e,
        ),
    );
    if (!next.extras.length) delete next.extras;
  }

  const pivot =
    isEngineeringDomain(analyzed.domain) && !isEngineeringDomain(resumeDomain);
  const transferables = collectTransferables(next);

  if (pivot) {
    thinking.push(
      "Hard domain pivot detected (support/ops → software/AI). Applying honest transition framing — will NOT invent TypeScript/React/etc.",
    );
    next.headline =
      analyzed.domain === "ai"
        ? "Aspiring Software / AI Engineer | User-Facing Problem Solver"
        : "Aspiring Software Engineer | User-Facing Problem Solver | Fast Learner";
    next.summary = buildTransitionSummary(next, analyzed, transferables);

    const evidencedTech = analyzed.tools.filter((t) =>
      normalize(sourceText).includes(normalize(t)),
    );
    const originalItems = expandSkillItems(next.skills.flatMap((g) => g.items));
    // Keep original ops skills that show real history, but under Additional — not as fake eng skills
    const opsSkills = originalItems.filter(
      (i) =>
        /customer|sla|csat|crm|ticket|inbound|call|chat|excel|word|data entry|complaint|qa|sop/i.test(
          i,
        ),
    );
    next.skills = [
      {
        category: "Transferable Strengths",
        items: transferables.slice(0, 8),
      },
      {
        category: "Tools Already Used",
        items: uniquePreserve([
          ...evidencedTech,
          ...opsSkills.filter((i) => /excel|word|crm|ticket|ms /i.test(i)),
        ]).slice(0, 8),
      },
      {
        category: "Prior Domain Skills",
        items: uniquePreserve(opsSkills).slice(0, 8),
      },
    ].filter((g) => g.items.length > 0);

    thinking.push(
      `Transferables surfaced: ${transferables.slice(0, 5).join(", ") || "none"}.`,
    );
    thinking.push(
      `Tech gaps kept honest (not added as skills): ${analyzed.tools
        .filter((t) => !normalize(sourceText).includes(normalize(t)))
        .slice(0, 8)
        .join(", ")}.`,
    );
  } else {
    thinking.push("Same-domain tailor: rank existing skills/bullets by JD overlap only.");
    const allOriginalItems = expandSkillItems(next.skills.flatMap((g) => g.items));
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
    }
    if (!next.headline.trim() && analyzed.titleHints.length) {
      const evidenced = analyzed.titleHints.filter((t) =>
        normalize(sourceText).includes(normalize(t)),
      );
      if (evidenced.length) next.headline = evidenced.slice(0, 3).join(" | ");
    }
  }

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

  thinking.push("Reordered experience by relevance; wording stays factual.");

  return { resume: next, thinking, analysis: analyzed };
}

export function tailorResumeLocally(
  resume: StructuredResume,
  jobDescription: string,
): StructuredResume {
  return tailorResumeSmart(resume, jobDescription).resume;
}

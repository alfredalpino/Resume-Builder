/**
 * Display polish gate — capitalization, banned coach-speak, skill casing.
 * Runs on every tailored resume before preview / PDF / DOCX.
 */

import type { StructuredResume } from "@/lib/schema";

const BANNED_PHRASES = [
  /\bdeliberate pivot\b/gi,
  /\baspiring\b/gi,
  /\btools already used\b/gi,
  /\btransferable strengths\b/gi,
  /\bfollowing up politely\b/gi,
  /\bcandidate with proven\b/gi,
  /\bintentionally pivoting\b/gi,
  /\bcore transferables:\b/gi,
];

const LOW_SIGNAL_SKILLS =
  /^(basic computer operations|computer operations|ms office basics|typing|data entry)$/i;

export function capitalizeSentence(text: string): string {
  const t = text.replace(/\s{2,}/g, " ").trim();
  if (!t) return t;
  return t[0].toUpperCase() + t.slice(1);
}

/** Title-case role / skill labels while preserving acronyms (AI, SLA, QA, CSAT). */
export function titleCasePhrase(text: string): string {
  const acronyms = new Set([
    "ai",
    "ml",
    "ui",
    "ux",
    "api",
    "sla",
    "csat",
    "qa",
    "crm",
    "bpo",
    "sop",
    "ats",
    "ci",
    "cd",
    "sql",
    "css",
    "html",
    "aws",
    "gcp",
  ]);
  return text
    .split(/(\s+|\/|\(|\))/g)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || part === "/" || part === "(" || part === ")") {
        return part;
      }
      const lower = part.toLowerCase();
      if (acronyms.has(lower)) return lower.toUpperCase();
      if (/^[A-Z0-9.+#-]{2,}$/.test(part) && /[A-Z]/.test(part) && /[0-9.+#-]/.test(part)) {
        return part; // TypeScript, Node.js, C++
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

export function scrubBannedPhrases(text: string): string {
  let out = text;
  for (const re of BANNED_PHRASES) out = out.replace(re, "");
  return out
    .replace(/\bfollowing up politely\.?/gi, "")
    .replace(/\band\s*\./gi, ".")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .replace(/\.\s*\./g, ".")
    .trim();
}

export function polishSkillItem(item: string): string {
  const cleaned = item.replace(/\s*\/\s*/g, " / ").trim();
  if (!cleaned) return cleaned;
  // Preserve intentional sentence-case reframes that start mid-phrase after lex
  if (/^(user-issue|multi-channel|cross-functional)/i.test(cleaned)) {
    return capitalizeSentence(cleaned);
  }
  return titleCasePhrase(cleaned);
}

export function polishResume(resume: StructuredResume): StructuredResume {
  const next = structuredClone(resume);
  next.headline = scrubBannedPhrases(next.headline || "");
  if (next.headline) {
    next.headline = next.headline
      .split(/\s*\|\s*/)
      .map((p) => titleCasePhrase(p.trim()))
      .filter(Boolean)
      .join(" | ");
  }

  let summary = scrubBannedPhrases(next.summary || "");
  summary = capitalizeSentence(summary);
  next.summary = summary;

  next.skills = next.skills
    .map((g) => ({
      category: g.category,
      items: g.items
        .filter((i) => !LOW_SIGNAL_SKILLS.test(i.trim()))
        .map(polishSkillItem)
        .filter(Boolean),
    }))
    .filter((g) => g.items.length > 0);

  // Drop Applications that are only data-entry fluff on eng-facing resumes
  next.skills = next.skills.filter((g) => {
    if (g.category !== "Applications") return true;
    const useful = g.items.filter(
      (i) => !/^data entry/i.test(i) || /\b(excel|word|crm|jira|git)\b/i.test(i),
    );
    g.items = useful;
    return useful.length > 0;
  });

  next.experience = next.experience.map((job) => ({
    ...job,
    company: job.company.trim(),
    title: capitalizeSentence(job.title.trim()),
    bullets: job.bullets.map((b) => capitalizeSentence(b.trim())).filter(Boolean),
  }));

  next.projects = next.projects.map((p) => ({
    ...p,
    name: p.name.trim(),
    bullets: p.bullets.map((b) => capitalizeSentence(b.trim())).filter(Boolean),
  }));

  return next;
}

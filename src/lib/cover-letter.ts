import { analyzeJobDescription, detectResumeDomain, pickBestTitle, type JdAnalysis } from "@/lib/nlp";
import { pivotDistance, type TailorIntensity } from "@/lib/center";
import type { StructuredResume } from "@/lib/schema";
import { titleCasePhrase, capitalizeSentence } from "@/lib/resume/polish";
import { buildOptimizationPlan } from "@/lib/resume/optimizer-plan";
import { resumeToPlainText } from "@/lib/schema";
import { writeCoverLetterWithClaude } from "@/lib/resume/writer-claude";
import { getEntitlements } from "@/lib/billing/entitlements";

export type CoverLetterStrategy = {
  primaryStrength: string;
  secondaryStrength: string;
  mostRelevantExperience: string;
  tone: "professional" | "pivot_honest" | "same_domain";
  company: string;
  role: string;
};

export function buildCoverLetterStrategy(
  resume: StructuredResume,
  jobDescription: string,
  intensity: TailorIntensity,
  analysis?: JdAnalysis,
): CoverLetterStrategy {
  const analyzed = analysis ?? analyzeJobDescription(jobDescription);
  const recent = resume.experience[0];
  const skills = resume.skills.flatMap((g) => g.items).slice(0, 6);
  return {
    primaryStrength: skills[0] || "clarifying requirements and delivering under pressure",
    secondaryStrength: skills[1] || "cross-functional collaboration",
    mostRelevantExperience: recent
      ? `${recent.title} at ${recent.company}`
      : "prior professional experience",
    tone:
      intensity === "hard"
        ? "pivot_honest"
        : intensity === "subtle"
          ? "same_domain"
          : "professional",
    company: analyzed.companyHints[0] || "the hiring team",
    role: titleCasePhrase(pickBestTitle(analyzed.titleHints, analyzed.domain)),
  };
}

export async function buildCoverLetter(
  resume: StructuredResume,
  jobDescription: string,
  intensity: TailorIntensity = "medium",
  analysis?: JdAnalysis,
  userEmail?: string | null,
): Promise<{ letter: string; thinking: string[]; strategy: CoverLetterStrategy }> {
  const analyzed = analysis ?? analyzeJobDescription(jobDescription);
  const strategy = buildCoverLetterStrategy(resume, jobDescription, intensity, analyzed);
  const thinking: string[] = [
    `Cover letter targeted at ${strategy.role} @ ${strategy.company}.`,
    `Tone: ${strategy.tone}.`,
  ];

  const entitlements = getEntitlements(userEmail);
  const sourceText = resumeToPlainText(resume);
  const resumeDomain = detectResumeDomain(sourceText);
  const distance = pivotDistance(resumeDomain, analyzed.domain);
  const plan = buildOptimizationPlan({
    resume,
    analysis: analyzed,
    distance,
    intensity,
    themes: [],
    evidenced: analyzed.tools.filter((t) =>
      new RegExp(`\\b${t.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i").test(sourceText),
    ),
    missing: [],
    resumeDomain,
  });

  if (entitlements.aiWriter) {
    const aiLetter = await writeCoverLetterWithClaude(
      resume,
      plan,
      jobDescription,
      strategy as unknown as Record<string, string>,
    );
    if (aiLetter) {
      thinking.push("Writer: AI (OpenRouter/Anthropic).");
      return { letter: aiLetter, thinking, strategy };
    }
    thinking.push("AI cover unavailable — deterministic strategy letter.");
  }

  const letter = renderDeterministicLetter(resume, strategy, intensity, analyzed);
  thinking.push("Writer: deterministic strategy letter.");
  return { letter, thinking, strategy };
}

function renderDeterministicLetter(
  resume: StructuredResume,
  strategy: CoverLetterStrategy,
  intensity: TailorIntensity,
  analyzed: JdAnalysis,
): string {
  const name = resume.contact.fullName || "Candidate";
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const recent = resume.experience[0];
  const tools = analyzed.tools.filter((t) =>
    new RegExp(`\\b${t.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\b`, "i").test(
      resumeToPlainText(resume),
    ),
  );

  const opener =
    strategy.tone === "pivot_honest"
      ? `I am writing to apply for the ${strategy.role} role at ${strategy.company}. I bring strong ${strategy.primaryStrength.toLowerCase()} from ${strategy.mostRelevantExperience}, and I am building toward product engineering work with the same discipline around clarity, reliability, and follow-through.`
      : strategy.tone === "same_domain"
        ? `I am writing to apply for the ${strategy.role} position at ${strategy.company}. Your posting aligns closely with the work I have already been doing.`
        : `I am writing to apply for the ${strategy.role} role at ${strategy.company}. I care about clear outcomes, and your description matches how I like to work.`;

  const bodyExperience = recent
    ? `Most recently as ${recent.title} at ${recent.company}, I ${summarizeBullets(recent.bullets)}.`
    : resume.summary
      ? `In short: ${capitalizeSentence(resume.summary.split(/[.!?]/)[0].trim())}.`
      : `I bring hands-on experience clarifying requirements, collaborating across teams, and delivering under real deadlines.`;

  const bodyFit =
    strategy.tone === "pivot_honest"
      ? `I will not claim technologies I have not used. What I do bring is ${strategy.primaryStrength.toLowerCase()} and ${strategy.secondaryStrength.toLowerCase()}. I want to contribute on ownership-heavy product work and grow into ${
          analyzed.tools.slice(0, 4).join(", ") || "your core stack"
        } with integrity.`
      : tools.length
        ? `I already work with ${tools.slice(0, 5).join(", ")}, and I am comfortable owning work from a vague problem through delivery.`
        : `I am strongest at turning ambiguous needs into clear next steps, documenting carefully, and staying close to quality signals.`;

  const bodyThemes = analyzed.keywords.slice(0, 4).length
    ? `I was particularly drawn to your emphasis on ${analyzed.keywords.slice(0, 4).join(", ")}.`
    : `I was particularly drawn to how your team ships while staying close to real users.`;

  const close = `Thank you for your time and consideration. I would welcome the chance to discuss how I can help ${strategy.company} move faster on this role's priorities.\n\nSincerely,\n${name}${
    resume.contact.email ? `\n${resume.contact.email}` : ""
  }${resume.contact.phone ? `\n${resume.contact.phone}` : ""}`;

  return [
    today,
    "",
    `Dear ${strategy.company} Hiring Team,`,
    "",
    capitalizeSentence(opener),
    "",
    bodyExperience,
    "",
    bodyFit,
    "",
    bodyThemes,
    "",
    close,
  ].join("\n");
}

function summarizeBullets(bullets: string[]): string {
  const first = bullets[0]?.replace(/\.$/, "") || "owned clear outcomes under pressure";
  const second = bullets[1]?.replace(/\.$/, "");
  if (second) {
    return `${first.charAt(0).toLowerCase()}${first.slice(1)}, and ${second.charAt(0).toLowerCase()}${second.slice(1)}`;
  }
  return `${first.charAt(0).toLowerCase()}${first.slice(1)}`;
}

// Sync wrapper for routes that cannot await (prefer async buildCoverLetter)
export function buildCoverLetterSync(
  resume: StructuredResume,
  jobDescription: string,
  intensity: TailorIntensity = "medium",
  analysis?: JdAnalysis,
): { letter: string; thinking: string[] } {
  const analyzed = analysis ?? analyzeJobDescription(jobDescription);
  const strategy = buildCoverLetterStrategy(resume, jobDescription, intensity, analyzed);
  return {
    letter: renderDeterministicLetter(resume, strategy, intensity, analyzed),
    thinking: [`Cover letter targeted at ${strategy.role} @ ${strategy.company}.`],
  };
}

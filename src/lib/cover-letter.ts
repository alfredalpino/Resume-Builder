import { analyzeJobDescription, pickBestTitle, type JdAnalysis } from "@/lib/nlp";
import type { TailorIntensity } from "@/lib/center";
import type { StructuredResume } from "@/lib/schema";

/**
 * Truthful cover letter — mirrors JD themes using only evidenced resume facts.
 * Never invents employers, degrees, or unearned tech.
 */
export function buildCoverLetter(
  resume: StructuredResume,
  jobDescription: string,
  intensity: TailorIntensity = "medium",
  analysis?: JdAnalysis,
): { letter: string; thinking: string[] } {
  const analyzed = analysis ?? analyzeJobDescription(jobDescription);
  const thinking: string[] = [];
  const name = resume.contact.fullName || "Candidate";
  const company = analyzed.companyHints[0] || "the hiring team";
  const role = pickBestTitle(analyzed.titleHints, analyzed.domain);

  const tools = analyzed.tools.filter((t) =>
    new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
      [
        resume.summary,
        resume.headline,
        ...resume.skills.flatMap((g) => g.items),
        ...resume.experience.flatMap((j) => j.bullets),
        ...resume.projects.flatMap((p) => p.bullets),
      ].join(" "),
    ),
  );

  const recent = resume.experience[0];
  const transferables = resume.skills
    .filter((g) => /transferable|core|strength/i.test(g.category))
    .flatMap((g) => g.items)
    .slice(0, 4);
  const themes = analyzed.keywords
    .filter((k) => analyzed.tools.some((t) => t.toLowerCase() === k.toLowerCase()) || /ownership|user-facing|ship|agent|ui/i.test(k))
    .slice(0, 5);

  thinking.push(`Cover letter targeted at ${role} @ ${company}.`);
  thinking.push(`Intensity ${intensity}; evidenced tools mentioned: ${tools.slice(0, 5).join(", ") || "none"}.`);

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const opener =
    intensity === "hard"
      ? `I am writing to apply for the ${role} role at ${company}. I am intentionally pivoting toward product engineering, and this role’s focus on shipping real systems is exactly the work I want to grow into.`
      : intensity === "subtle"
        ? `I am writing to apply for the ${role} position at ${company}. Your posting aligns closely with the work I have already been doing and the skills I lead with.`
        : `I am writing to apply for the ${role} role at ${company}. I care about clear product outcomes, and your description matches how I like to work.`;

  const bodyExperience = recent
    ? `Most recently as ${recent.title} at ${recent.company}, I ${summarizeBullets(recent.bullets)}.`
    : resume.summary
      ? `In short: ${resume.summary.split(/[.!?]/)[0].trim()}.`
      : `I bring hands-on experience clarifying requirements, collaborating across teams, and delivering under real deadlines.`;

  const bodyFit =
    intensity === "hard"
      ? `I will not claim stack experience I do not have yet. What I do bring is ${
          transferables.length
            ? transferables.join(", ").toLowerCase()
            : "user-facing problem solving, reliability under SLA pressure, and fast learning"
        }. I am actively aligning toward ${
          analyzed.tools.slice(0, 5).join(", ") || "your core stack"
        } and I want to contribute from day one on ownership-heavy product work.`
      : tools.length
        ? `I already work with ${tools.slice(0, 5).join(", ")}, and I am comfortable owning features from a vague problem through production.`
        : `I am strongest at turning ambiguous user needs into shipped outcomes, documenting clearly, and staying close to quality signals after release.`;

  const bodyThemes = themes.length
    ? `I was particularly drawn to your emphasis on ${themes.slice(0, 4).join(", ")}.`
    : `I was particularly drawn to how your team ships quickly while staying close to real users.`;

  const close = `Thank you for your time and consideration. I would welcome the chance to discuss how I can help ${company} move faster on this role’s priorities.\n\nSincerely,\n${name}${
    resume.contact.email ? `\n${resume.contact.email}` : ""
  }${resume.contact.phone ? `\n${resume.contact.phone}` : ""}`;

  const letter = [
    today,
    "",
    `Dear ${company} Hiring Team,`,
    "",
    opener,
    "",
    bodyExperience,
    "",
    bodyFit,
    "",
    bodyThemes,
    "",
    close,
  ].join("\n");

  return { letter, thinking };
}

function summarizeBullets(bullets: string[]): string {
  const first = bullets[0]?.replace(/\.$/, "") || "owned clear outcomes under pressure";
  const second = bullets[1]?.replace(/\.$/, "");
  if (second) {
    return `${first.charAt(0).toLowerCase()}${first.slice(1)}, and ${second.charAt(0).toLowerCase()}${second.slice(1)}`;
  }
  return `${first.charAt(0).toLowerCase()}${first.slice(1)}`;
}

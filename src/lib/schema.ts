import { z } from "zod";

export const ResumeLinkSchema = z.object({
  label: z.string().min(1),
  url: z
    .string()
    .min(1)
    .refine((v) => /^https?:\/\//i.test(v) || z.string().url().safeParse(v).success, {
      message: "Invalid URL",
    }),
});

export const SkillGroupSchema = z.object({
  category: z.string().min(1),
  items: z.array(z.string().min(1)).default([]),
});

export const ExperienceSchema = z.object({
  company: z.string().min(1),
  title: z.string().min(1),
  location: z.string().optional(),
  start: z.string().default(""),
  end: z.string().default("Present"),
  bullets: z.array(z.string()).default([]),
});

export const EducationSchema = z.object({
  school: z.string().min(1),
  degree: z.string().min(1),
  dates: z.string().default(""),
  details: z.string().optional(),
});

export const ProjectSchema = z.object({
  name: z.string().min(1),
  url: z.string().optional(),
  bullets: z.array(z.string()).default([]),
});

export const StructuredResumeSchema = z.object({
  contact: z.object({
    fullName: z.string().min(1),
    email: z.string().default(""),
    phone: z.string().default(""),
    location: z.string().optional(),
    links: z.array(ResumeLinkSchema).default([]),
  }),
  headline: z.string().default(""),
  summary: z.string().default(""),
  skills: z.array(SkillGroupSchema).default([]),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  certifications: z.array(z.string()).default([]),
  projects: z.array(ProjectSchema).default([]),
  extras: z.array(z.string()).optional(),
});

export type StructuredResume = z.infer<typeof StructuredResumeSchema>;
export type ResumeLink = z.infer<typeof ResumeLinkSchema>;

export const AtsScoreSchema = z.object({
  matchRate: z.number(),
  keywordScore: z.number(),
  formatScore: z.number(),
  hits: z.array(z.string()),
  missing: z.array(z.string()),
  formatNotes: z.array(z.string()),
  target: z.literal(75),
});

export type AtsScore = z.infer<typeof AtsScoreSchema>;

export function emptyResume(): StructuredResume {
  return {
    contact: {
      fullName: "Your Name",
      email: "",
      phone: "",
      location: "",
      links: [],
    },
    headline: "",
    summary: "",
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    extras: [],
  };
}

export function resumeToPlainText(resume: StructuredResume): string {
  const lines: string[] = [];
  lines.push(resume.contact.fullName);
  if (resume.headline) lines.push(resume.headline);
  const contactBits = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    ...resume.contact.links.map((l) => `${l.label}: ${l.url}`),
  ].filter(Boolean);
  if (contactBits.length) lines.push(contactBits.join(" | "));
  if (resume.summary) {
    lines.push("PROFESSIONAL SUMMARY", resume.summary);
  }
  if (resume.skills.length) {
    lines.push("TECHNICAL SKILLS");
    for (const g of resume.skills) {
      lines.push(`${g.category}: ${g.items.join(" | ")}`);
    }
  }
  if (resume.certifications.length) {
    lines.push("CERTIFICATIONS", ...resume.certifications);
  }
  if (resume.experience.length) {
    lines.push("PROFESSIONAL EXPERIENCE");
    for (const job of resume.experience) {
      lines.push(
        `${job.company} — ${job.title} | ${job.start} – ${job.end}${job.location ? ` | ${job.location}` : ""}`,
      );
      for (const b of job.bullets) lines.push(`- ${b}`);
    }
  }
  if (resume.projects.length) {
    lines.push("PROJECTS");
    for (const p of resume.projects) {
      lines.push(`${p.name}${p.url ? ` | ${p.url}` : ""}`);
      for (const b of p.bullets) lines.push(`- ${b}`);
    }
  }
  if (resume.education.length) {
    lines.push("EDUCATION");
    for (const e of resume.education) {
      lines.push(
        `${e.degree} — ${e.school}${e.dates ? ` | ${e.dates}` : ""}${e.details ? ` | ${e.details}` : ""}`,
      );
    }
  }
  if (resume.extras?.length) {
    lines.push("ADDITIONAL", ...resume.extras);
  }
  return lines.join("\n");
}

/**
 * Natural-language Resume Compiler
 *
 * Pipeline: NL text → sectionize → extract entities → Zod IR → polish
 * Optional: LLM structured fill when freeform / incomplete.
 *
 * Intermediate Representation = StructuredResume (single source of truth for PDF/DOCX).
 */
import {
  emptyResume,
  StructuredResumeSchema,
  type StructuredResume,
} from "@/lib/schema";
import { polishResume } from "@/lib/resume/polish";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/;
const URL_RE = /https?:\/\/[^\s)]+/gi;

export type CompileEngine = "deterministic" | "hybrid" | "ai";

export type CompileResult = {
  resume: StructuredResume;
  engine: CompileEngine;
  warnings: string[];
  sectionsFound: string[];
};

type SectionKey =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "awards"
  | "headline"
  | "extras";

const SECTION_ALIASES: Record<string, SectionKey> = {
  name: "contact",
  contact: "contact",
  "contact info": "contact",
  "personal info": "contact",
  about: "summary",
  summary: "summary",
  "professional summary": "summary",
  profile: "summary",
  objective: "summary",
  headline: "headline",
  title: "headline",
  "target role": "headline",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  employment: "experience",
  work: "experience",
  education: "education",
  academic: "education",
  schooling: "education",
  skills: "skills",
  "skill set": "skills",
  "technical skills": "skills",
  competencies: "skills",
  "core competencies": "skills",
  projects: "projects",
  project: "projects",
  certifications: "certifications",
  certificates: "certifications",
  certification: "certifications",
  awards: "awards",
  achievements: "awards",
  honors: "awards",
  extras: "extras",
  additional: "extras",
  other: "extras",
};

function normalizeHeader(line: string): SectionKey | null {
  const cleaned = line
    .replace(/^[#*\-•\d.)\s]+/, "")
    .replace(/[:|\-–—]+$/, "")
    .trim()
    .toLowerCase();
  if (!cleaned || cleaned.length > 48) return null;
  if (SECTION_ALIASES[cleaned]) return SECTION_ALIASES[cleaned];
  for (const [alias, key] of Object.entries(SECTION_ALIASES)) {
    if (cleaned === alias || cleaned.startsWith(`${alias} `)) return key;
  }
  // "Experience:" style already handled; bare ALL CAPS headers
  if (/^[A-Z][A-Z\s&/]{2,40}$/.test(line.trim())) {
    const soft = line.trim().toLowerCase();
    if (SECTION_ALIASES[soft]) return SECTION_ALIASES[soft];
  }
  return null;
}

function splitSections(text: string): { order: SectionKey[]; buckets: Record<SectionKey, string[]> } {
  const buckets = {
    contact: [],
    summary: [],
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    awards: [],
    headline: [],
    extras: [],
  } as Record<SectionKey, string[]>;
  const order: SectionKey[] = [];
  let current: SectionKey = "contact";

  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trimEnd());

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Inline "Name: Alice" / "Email: a@b.com"
    const inline = line.match(/^([A-Za-z][A-Za-z\s]{0,28})\s*[:\-–—]\s*(.+)$/);
    if (inline) {
      const key = normalizeHeader(inline[1]);
      if (key === "contact" || key === "headline") {
        if (!order.includes(key)) order.push(key);
        buckets[key].push(`${inline[1].trim()}: ${inline[2].trim()}`);
        current = key === "headline" ? "headline" : "contact";
        continue;
      }
      if (key && key !== "experience" && key !== "education" && key !== "projects") {
        if (!order.includes(key)) order.push(key);
        current = key;
        buckets[key].push(inline[2].trim());
        continue;
      }
    }

    const header = normalizeHeader(line.replace(/:$/, ""));
    if (header && line.length < 50 && !/^[•\-]/.test(line)) {
      current = header;
      if (!order.includes(header)) order.push(header);
      continue;
    }

    if (!order.includes(current)) order.push(current);
    buckets[current].push(line);
  }

  return { order, buckets };
}

function parseContact(lines: string[], draft: StructuredResume) {
  const blob = lines.join("\n");
  const email = blob.match(EMAIL_RE)?.[0];
  if (email) draft.contact.email = email;
  const phone = blob.match(PHONE_RE)?.[0];
  if (phone && phone.replace(/\D/g, "").length >= 8) {
    draft.contact.phone = phone.trim();
  }
  const urls = blob.match(URL_RE) || [];
  for (const url of urls) {
    if (draft.contact.links.some((l) => l.url === url)) continue;
    const label = /github/i.test(url)
      ? "GitHub"
      : /linkedin/i.test(url)
        ? "LinkedIn"
        : "Portfolio";
    draft.contact.links.push({ label, url });
  }

  for (const line of lines) {
    const m = line.match(/^(name|full\s*name|email|phone|mobile|location|city|linkedin|github|portfolio)\s*[:\-–—]\s*(.+)$/i);
    if (m) {
      const k = m[1].toLowerCase().replace(/\s+/g, "");
      const v = m[2].trim();
      if (k === "name" || k === "fullname") draft.contact.fullName = v;
      else if (k === "email") draft.contact.email = v;
      else if (k === "phone" || k === "mobile") draft.contact.phone = v;
      else if (k === "location" || k === "city") draft.contact.location = v;
      else if (k === "linkedin" || k === "github" || k === "portfolio") {
        const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
        draft.contact.links.push({
          label: k === "linkedin" ? "LinkedIn" : k === "github" ? "GitHub" : "Portfolio",
          url,
        });
      }
      continue;
    }
    // First non-field line that looks like a name
    if (
      draft.contact.fullName === "Your Name" &&
      !EMAIL_RE.test(line) &&
      !PHONE_RE.test(line) &&
      !URL_RE.test(line) &&
      line.split(/\s+/).length <= 5 &&
      line.length < 60
    ) {
      draft.contact.fullName = line;
    } else if (!draft.contact.location && /,/.test(line) && line.length < 60 && !EMAIL_RE.test(line)) {
      draft.contact.location = line;
    }
  }
}

function parseExperience(lines: string[]): StructuredResume["experience"] {
  const jobs: StructuredResume["experience"] = [];
  let current: StructuredResume["experience"][0] | null = null;

  const flush = () => {
    if (current) jobs.push(current);
    current = null;
  };

  for (const line of lines) {
    if (/^[•\-*]/.test(line) || (/^\d+\./.test(line) && current)) {
      const bullet = line.replace(/^[•\-*]\s*|^\d+\.\s*/, "").trim();
      if (bullet && current) current.bullets.push(bullet);
      continue;
    }

    // Company — Title | 2020 – 2023 | City
    // Title at Company (2020-Present)
    const emDash = line.match(
      /^(.+?)\s+[—–\-]\s+(.+?)(?:\s*[|·]\s*(.+))?$/,
    );
    const atForm = line.match(
      /^(.+?)\s+at\s+(.+?)(?:\s*[|(]\s*(.+?))?\)?$/i,
    );
    const dateRange = line.match(
      /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\b\d{4})\s*[–\-—to]+\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}|Present|Current)/i,
    );

    if (emDash || atForm) {
      flush();
      if (emDash) {
        current = {
          company: emDash[1].trim(),
          title: emDash[2].trim(),
          start: "",
          end: "Present",
          bullets: [],
        };
        const rest = emDash[3] || "";
        const dr = rest.match(
          /(.+?)\s*[–\-—]\s*(.+?)(?:\s*[|·]\s*(.+))?$/,
        );
        if (dr) {
          current.start = dr[1].trim();
          current.end = dr[2].trim();
          if (dr[3]) current.location = dr[3].trim();
        } else if (rest) {
          current.location = rest.trim();
        }
      } else if (atForm) {
        current = {
          title: atForm[1].trim(),
          company: atForm[2].trim(),
          start: "",
          end: "Present",
          bullets: [],
        };
        if (atForm[3]) {
          const bits = atForm[3].split(/[|·]/).map((s) => s.trim());
          for (const b of bits) {
            if (/\d{4}|present|current/i.test(b)) {
              const parts = b.split(/\s*[–\-—to]+\s*/i);
              current.start = parts[0]?.trim() || "";
              current.end = parts[1]?.trim() || "Present";
            } else if (b) current.location = b;
          }
        }
      }
      if (dateRange && current && !current.start) {
        current.start = dateRange[1];
        current.end = dateRange[2];
      }
      continue;
    }

    if (dateRange && current && !current.start) {
      current.start = dateRange[1];
      current.end = dateRange[2];
      continue;
    }

    if (current && line.length > 20) {
      current.bullets.push(line);
    } else if (!current) {
      current = {
        company: line,
        title: "Role",
        start: "",
        end: "Present",
        bullets: [],
      };
    }
  }
  flush();
  return jobs.filter((j) => j.company && j.company !== "Role");
}

function parseEducation(lines: string[]): StructuredResume["education"] {
  const out: StructuredResume["education"] = [];
  for (const line of lines) {
    if (/^[•\-*]/.test(line)) {
      const detail = line.replace(/^[•\-*]\s*/, "");
      if (out.length) {
        out[out.length - 1].details = [out[out.length - 1].details, detail]
          .filter(Boolean)
          .join("; ");
      }
      continue;
    }
    const m = line.match(/^(.+?)\s+[—–\-]\s+(.+?)(?:\s*[|·]\s*(.+))?$/);
    if (m) {
      out.push({
        degree: m[1].trim(),
        school: m[2].trim(),
        dates: m[3]?.trim() || "",
      });
    } else {
      out.push({ degree: line, school: line, dates: "" });
    }
  }
  return out;
}

function parseSkills(lines: string[]): StructuredResume["skills"] {
  const groups: StructuredResume["skills"] = [];
  for (const line of lines) {
    const cat = line.match(/^([^:|]+)\s*[:|]\s*(.+)$/);
    if (cat) {
      groups.push({
        category: cat[1].trim(),
        items: cat[2]
          .split(/[,|•·]/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
    } else {
      const items = line
        .replace(/^[•\-*]\s*/, "")
        .split(/[,|•·]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!items.length) continue;
      const existing = groups.find((g) => g.category === "Core Skills");
      if (existing) existing.items.push(...items);
      else groups.push({ category: "Core Skills", items });
    }
  }
  return groups;
}

function parseProjects(lines: string[]): StructuredResume["projects"] {
  const projects: StructuredResume["projects"] = [];
  let current: StructuredResume["projects"][0] | null = null;
  for (const line of lines) {
    if (/^[•\-*]/.test(line) && current) {
      current.bullets.push(line.replace(/^[•\-*]\s*/, ""));
      continue;
    }
    const url = line.match(URL_RE)?.[0];
    const name = line
      .replace(URL_RE, "")
      .replace(/\s*[|·]\s*$/, "")
      .trim();
    if (name) {
      if (current) projects.push(current);
      current = { name, url: url || undefined, bullets: [] };
    }
  }
  if (current) projects.push(current);
  return projects;
}

function listLines(lines: string[]): string[] {
  return lines
    .map((l) => l.replace(/^[•\-*]\s*|^\d+\.\s*/, "").trim())
    .filter(Boolean);
}

function looksLabeled(text: string): boolean {
  const headers = text.match(
    /^(name|experience|education|skills|projects|certifications?|awards|summary|headline)\s*:/gim,
  );
  return (headers?.length || 0) >= 2;
}

/**
 * Deterministic compile from natural language / labeled notes.
 */
export function compileDeterministic(text: string): CompileResult {
  const warnings: string[] = [];
  const draft = emptyResume();
  const trimmed = text.trim();
  if (trimmed.length < 20) {
    return {
      resume: draft,
      engine: "deterministic",
      warnings: ["Input too short — add name, experience, education, and skills."],
      sectionsFound: [],
    };
  }

  const { order, buckets } = splitSections(trimmed);
  parseContact(
    [...buckets.contact, ...(order[0] === "contact" ? [] : [])],
    draft,
  );

  // If name still missing, first line of whole text
  if (draft.contact.fullName === "Your Name") {
    const first = trimmed.split("\n").map((l) => l.trim()).find(Boolean);
    if (first && !EMAIL_RE.test(first) && first.length < 60) {
      const withoutLabel = first.replace(/^(name|full\s*name)\s*[:\-–—]\s*/i, "");
      draft.contact.fullName = withoutLabel;
    }
  }

  if (buckets.headline.length) {
    draft.headline = buckets.headline.join(" ").slice(0, 140);
  }
  if (buckets.summary.length) {
    draft.summary = buckets.summary.join(" ").slice(0, 900);
  }
  draft.experience = parseExperience(buckets.experience);
  draft.education = parseEducation(buckets.education);
  draft.skills = parseSkills(buckets.skills);
  draft.projects = parseProjects(buckets.projects);
  draft.certifications = listLines(buckets.certifications);
  draft.awards = listLines(buckets.awards);
  if (buckets.extras.length) {
    draft.extras = listLines(buckets.extras);
  }

  // Freeform fallback: no experience section found — try whole text after contact
  if (!draft.experience.length && !looksLabeled(trimmed)) {
    warnings.push(
      "Could not clearly detect Experience — AI compile recommended for freeform prose.",
    );
  }
  if (draft.contact.fullName === "Your Name") {
    warnings.push("Name not detected — add a Name: line.");
  }
  if (!draft.skills.length) warnings.push("No skills detected.");
  if (!draft.experience.length) warnings.push("No work experience detected.");

  const parsed = StructuredResumeSchema.safeParse(polishResume(draft));
  return {
    resume: parsed.success ? parsed.data : polishResume(draft),
    engine: "deterministic",
    warnings,
    sectionsFound: order,
  };
}

export function completenessScore(resume: StructuredResume): number {
  let pts = 0;
  if (resume.contact.fullName && resume.contact.fullName !== "Your Name") pts += 20;
  if (resume.contact.email) pts += 10;
  if (resume.summary.length > 40) pts += 15;
  if (resume.skills.some((g) => g.items.length)) pts += 15;
  if (resume.experience.length) pts += 25;
  if (resume.education.length) pts += 10;
  if (resume.projects.length || resume.certifications.length || resume.awards?.length) {
    pts += 5;
  }
  return Math.min(100, pts);
}

export const COMPILE_PLACEHOLDER = `Name: Your Full Name
Email: you@email.com
Phone: +91 98765 43210
Location: City, Country
Headline: Target Role Title

Summary:
2–3 sentences about your background and strengths.

Experience:
Company Name — Job Title | Jan 2022 – Present | City
- Accomplishment with metric
- Second accomplishment

Earlier Co — Role | 2019 – 2021
- What you owned and shipped

Education:
B.Tech Computer Science — University Name | 2019

Skills:
Languages: TypeScript, Python
Frameworks: Next.js, React
Tools: Docker, Git

Projects:
Portfolio Site | https://example.com
- Built with Next.js and deployed to production

Certifications:
- AWS Certified Cloud Practitioner

Awards:
- Employee of the Month, 2023`;

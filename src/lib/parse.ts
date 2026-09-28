import mammoth from "mammoth";
import { extractText } from "unpdf";
import type { ResumeLink, StructuredResume } from "@/lib/schema";
import { emptyResume } from "@/lib/schema";

const MAX_BYTES = 5 * 1024 * 1024;

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/;

export type ParseResult = {
  rawText: string;
  links: ResumeLink[];
  draft: StructuredResume;
};

function normalizeUrl(url: string): string {
  return url.replace(/[.,;:!?)]+$/, "");
}

function labelForUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("linkedin")) return "LinkedIn";
    if (host.includes("github")) return "GitHub";
    if (host.includes("gitlab")) return "GitLab";
    if (
      host.includes("portfolio") ||
      host.includes("vercel") ||
      host.includes("netlify")
    ) {
      return "Portfolio";
    }
    return host;
  } catch {
    return "Link";
  }
}

export function extractLinksFromText(text: string): ResumeLink[] {
  const found = text.match(URL_RE) ?? [];
  const map = new Map<string, ResumeLink>();
  for (const raw of found) {
    const url = normalizeUrl(raw);
    if (!map.has(url)) {
      map.set(url, { label: labelForUrl(url), url });
    }
  }
  return [...map.values()];
}

function extractLinksFromHtml(html: string): ResumeLink[] {
  const hrefRe = /href=["'](https?:\/\/[^"']+)["']/gi;
  const map = new Map<string, ResumeLink>();
  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(html)) !== null) {
    const url = normalizeUrl(match[1]);
    if (!map.has(url)) {
      map.set(url, { label: labelForUrl(url), url });
    }
  }
  for (const link of extractLinksFromText(html)) {
    if (!map.has(link.url)) map.set(link.url, link);
  }
  return [...map.values()];
}

const SECTION_ALIASES: Record<string, string> = {
  summary: "summary",
  "professional summary": "summary",
  profile: "summary",
  objective: "summary",
  skills: "skills",
  "technical skills": "skills",
  "core competencies": "skills",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  employment: "experience",
  education: "education",
  certifications: "certifications",
  certificates: "certifications",
  projects: "projects",
  "labs and projects": "projects",
  labs: "projects",
  additional: "extras",
  awards: "extras",
};

function isSectionHeader(line: string): string | null {
  const cleaned = line.replace(/[:|]+$/g, "").trim().toLowerCase();
  if (SECTION_ALIASES[cleaned]) return SECTION_ALIASES[cleaned];
  const upper = line.replace(/[:|]+$/g, "").trim();
  if (upper === upper.toUpperCase() && upper.length > 3 && upper.length < 40) {
    const key = upper.toLowerCase();
    if (SECTION_ALIASES[key]) return SECTION_ALIASES[key];
  }
  return null;
}

function heuristicDraft(rawText: string, links: ResumeLink[]): StructuredResume {
  const draft = emptyResume();
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  draft.contact.fullName = lines[0]?.slice(0, 80) || "Your Name";
  const email = rawText.match(EMAIL_RE)?.[0];
  if (email) draft.contact.email = email;
  const phone = rawText.match(PHONE_RE)?.[0];
  if (phone && phone.replace(/\D/g, "").length >= 8) {
    draft.contact.phone = phone.trim();
  }
  draft.contact.links = links;

  const buckets: Record<string, string[]> = {
    summary: [],
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    extras: [],
    preamble: [],
  };

  let current = "preamble";
  for (const line of lines.slice(1)) {
    const section = isSectionHeader(line);
    if (section) {
      current = section;
      continue;
    }
    buckets[current] = buckets[current] || [];
    buckets[current].push(line);
  }

  if (buckets.preamble.length) {
    draft.headline = buckets.preamble[0]?.slice(0, 140) || "";
    if (!buckets.summary.length) {
      draft.summary = buckets.preamble.slice(1, 5).join(" ").slice(0, 700);
    }
  }

  if (buckets.summary.length) {
    draft.summary = buckets.summary.join(" ").slice(0, 900);
  }

  if (buckets.skills.length) {
    draft.skills = buckets.skills.map((line) => {
      const parts = line.split(/[:：]/);
      if (parts.length > 1) {
        return {
          category: parts[0].trim() || "Skills",
          items: parts
            .slice(1)
            .join(":")
            .split(/[|,•·]/)
            .map((s) => s.trim())
            .filter(Boolean),
        };
      }
      return {
        category: "Skills",
        items: line
          .split(/[|,•·]/)
          .map((s) => s.trim())
          .filter(Boolean),
      };
    });
  }

  if (buckets.certifications.length) {
    draft.certifications = buckets.certifications;
  }

  if (buckets.education.length) {
    draft.education = buckets.education.map((line) => {
      const bits = line.split(/[—–|-]/).map((s) => s.trim()).filter(Boolean);
      return {
        school: bits[1] || bits[0] || line,
        degree: bits[0] || line,
        dates: bits[2] || "",
        details: bits.slice(3).join(" | ") || undefined,
      };
    });
  }

  if (buckets.projects.length) {
    let currentProject: { name: string; url?: string; bullets: string[] } | null =
      null;
    for (const line of buckets.projects) {
      if (/^[-•*]/.test(line) && currentProject) {
        currentProject.bullets.push(line.replace(/^[-•*]\s*/, ""));
      } else {
        if (currentProject) draft.projects.push(currentProject);
        const url = line.match(URL_RE)?.[0];
        currentProject = {
          name: line.replace(URL_RE, "").replace(/\s*[|·-]\s*$/, "").trim() || line,
          url: url ? normalizeUrl(url) : undefined,
          bullets: [],
        };
      }
    }
    if (currentProject) draft.projects.push(currentProject);
  }

  if (buckets.experience.length) {
    let currentJob: {
      company: string;
      title: string;
      location?: string;
      start: string;
      end: string;
      bullets: string[];
    } | null = null;

    for (const line of buckets.experience) {
      if (/^[-•*]/.test(line) && currentJob) {
        currentJob.bullets.push(line.replace(/^[-•*]\s*/, ""));
        continue;
      }
      if (currentJob) draft.experience.push(currentJob);

      const dateMatch = line.match(
        /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*[–—-]\s*(Present|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})/i,
      );
      const start = dateMatch?.[1] || "";
      const end = dateMatch?.[2] || "Present";
      const withoutDates = dateMatch
        ? line.replace(dateMatch[0], "").replace(/\|\s*$/, "").trim()
        : line;
      const parts = withoutDates
        .split(/\s+[—–-]\s+|\s+\|\s+/)
        .map((p) => p.trim())
        .filter(Boolean);

      currentJob = {
        company: parts[0] || withoutDates,
        title: parts[1] || parts[0] || "Role",
        location: parts[2],
        start,
        end,
        bullets: [],
      };
    }
    if (currentJob) draft.experience.push(currentJob);
  }

  if (buckets.extras.length) {
    draft.extras = buckets.extras;
  }

  // Fallback summary if still empty
  if (!draft.summary) {
    draft.summary = lines.slice(1, 6).join(" ").slice(0, 600);
  }

  return draft;
}

export async function parseResumeBuffer(
  buffer: Buffer,
  filename: string,
  mimeType?: string,
): Promise<ParseResult> {
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error("File too large (max 5 MB)");
  }

  const lower = filename.toLowerCase();
  const type = (mimeType || "").toLowerCase();

  if (
    lower.endsWith(".docx") ||
    type.includes("officedocument.wordprocessingml") ||
    type.includes("msword")
  ) {
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const textResult = await mammoth.extractRawText({ buffer });
    const rawText = textResult.value.trim();
    const links = extractLinksFromHtml(htmlResult.value);
    return {
      rawText,
      links,
      draft: heuristicDraft(rawText, links),
    };
  }

  if (lower.endsWith(".pdf") || type.includes("pdf")) {
    const data = new Uint8Array(buffer);
    const { text } = await extractText(data, { mergePages: true });
    const rawText = (
      Array.isArray(text) ? text.join("\n") : String(text || "")
    ).trim();
    const links = extractLinksFromText(rawText);
    return {
      rawText,
      links,
      draft: heuristicDraft(rawText, links),
    };
  }

  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    type.startsWith("text/")
  ) {
    const rawText = buffer.toString("utf8").trim();
    const links = extractLinksFromText(rawText);
    return {
      rawText,
      links,
      draft: heuristicDraft(rawText, links),
    };
  }

  throw new Error("Unsupported file type. Use PDF, DOCX, TXT, or MD.");
}

export function parseResumeText(rawText: string): ParseResult {
  const text = rawText.trim();
  if (!text) throw new Error("Resume text is empty");
  const links = extractLinksFromText(text);
  return {
    rawText: text,
    links,
    draft: heuristicDraft(text, links),
  };
}

export { MAX_BYTES };

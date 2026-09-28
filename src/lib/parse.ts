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
    if (host.includes("portfolio") || host.includes("vercel") || host.includes("netlify")) {
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
    if (!map.has(url)) map.set(url, { label: labelForUrl(url), url });
  }
  return [...map.values()];
}

function extractLinksFromHtml(html: string): ResumeLink[] {
  const hrefRe = /href=["'](https?:\/\/[^"']+)["']/gi;
  const map = new Map<string, ResumeLink>();
  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(html)) !== null) {
    const url = normalizeUrl(match[1]);
    if (!map.has(url)) map.set(url, { label: labelForUrl(url), url });
  }
  for (const link of extractLinksFromText(html)) {
    if (!map.has(link.url)) map.set(link.url, link);
  }
  return [...map.values()];
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function dedupeText(text: string): string {
  const dates: string[] = [];
  const protectedText = text.replace(
    /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*[–—-]\s*(Present|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})/gi,
    (m) => {
      dates.push(m.replace(/\s*[–—-]\s*/, " – "));
      return `__DATE${dates.length - 1}__`;
    },
  );

  const parts = protectedText
    .split(/\s*[—–|·]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const p of parts) {
    const restored = p.replace(/__DATE(\d+)__/g, (_, i) => dates[Number(i)] || "");
    const k = normKey(restored);
    if (!k || seen.has(k)) continue;
    if (k.length <= 20 && [...seen].some((s) => s.includes(k))) continue;
    seen.add(k);
    kept.push(restored);
  }
  return kept.join(" · ");
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const k = normKey(line);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(line);
  }
  return out;
}

const SECTION_ALIASES: Record<string, string> = {
  summary: "summary",
  "professional summary": "summary",
  profile: "summary",
  objective: "summary",
  skills: "skills",
  "technical skills": "skills",
  "core skills": "skills",
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
  "selected production projects": "projects",
  "selected open source projects": "projects",
  "open source projects": "projects",
  "production projects": "projects",
  "selected projects": "projects",
  "key strengths": "ignore",
  "target roles": "ignore",
  "personal details": "ignore",
  languages: "ignore",
  interests: "ignore",
};

function isSectionHeader(line: string): string | null {
  const cleaned = line.replace(/[:|]+$/g, "").trim().toLowerCase();
  if (SECTION_ALIASES[cleaned]) return SECTION_ALIASES[cleaned];

  if (cleaned.length > 3 && cleaned.length < 70) {
    if (/\bprojects?\b/.test(cleaned) && !/\bexperience\b/.test(cleaned)) {
      return "projects";
    }
    if (/\b(professional|work)\s+experience\b|\bemployment\b/.test(cleaned)) {
      return "experience";
    }
    if (
      /\btechnical skills\b|\bcore skills\b|\bskills\b/.test(cleaned) &&
      cleaned.split(/\s+/).length <= 5
    ) {
      return "skills";
    }
    if (/^education\b/.test(cleaned)) return "education";
    if (/^certifications?\b|^certificates\b/.test(cleaned)) return "certifications";
    if (/^professional summary\b|^summary\b|^profile\b|^objective\b/.test(cleaned)) {
      return "summary";
    }
  }

  const upper = line.replace(/[:|]+$/g, "").trim();
  if (upper === upper.toUpperCase() && upper.length > 3 && upper.length < 60) {
    const key = upper.toLowerCase();
    if (SECTION_ALIASES[key]) return SECTION_ALIASES[key];
    if (/\bprojects?\b/.test(key)) return "projects";
  }
  return null;
}

function isLocationLine(line: string): boolean {
  // Job headers often end with a city — never treat those as location-only lines
  if (
    /\b(representative|engineer|developer|associate|executive|manager|intern|analyst|specialist|admin|lead|architect|consultant|officer|agent)\b/i.test(
      line,
    )
  ) {
    return false;
  }
  if (/\s+[—–]\s+/.test(line) && /\d{4}/.test(line)) return false;
  if (line.length > 100) return false;
  return /\b(lucknow|uttar pradesh|delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|pune|remote|india|dubai|delaware|usa|uae)\b/i.test(
    line,
  );
}

function isDateOnlyLine(line: string): boolean {
  return /^(?:\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*[–—-]\s*(Present|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})$/i.test(
    line.trim(),
  );
}

function splitSkillItems(raw: string): string[] {
  return raw
    .split(/\s*[|,•·—–]\s*|(?:\s+\/\s+)(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 80)
    .filter((s) => !/^(and|or|with|the)$/i.test(s));
}

function parseSkillLine(line: string): { category: string; items: string[] } {
  const parts = line.split(/[:：]/);
  if (parts.length > 1) {
    return {
      category: parts[0].trim() || "Skills",
      items: splitSkillItems(parts.slice(1).join(":")),
    };
  }
  return {
    category: "Skills",
    items: splitSkillItems(line),
  };
}

function looksLikeJobHeader(line: string): boolean {
  if (/^[-•*]/.test(line)) return false;
  if (isDateOnlyLine(line) || isLocationLine(line)) return false;
  const hasRole =
    /\b(engineer|developer|representative|associate|manager|analyst|intern|executive|specialist|administrator|admin|lead|architect|consultant|officer|agent|research analyst)\b/i.test(
      line,
    );
  const hasDates =
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}\s*[–—-]\s*(Present|\d{4}|[A-Z][a-z]+)/i.test(
      line,
    );
  const hasSep = /\s+[—–]\s+|\s+\|\s+|\s+·\s+/.test(line);
  if (hasRole && (hasDates || hasSep)) return true;
  if (hasDates && hasSep) return true;
  return false;
}

function parseJobHeader(line: string): {
  company: string;
  title: string;
  location?: string;
  start: string;
  end: string;
} {
  const dateMatch = line.match(
    /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*[–—-]\s*(Present|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})/i,
  );
  const start = dateMatch?.[1] || "";
  const end = dateMatch?.[2] || "";
  let rest = dateMatch ? line.replace(dateMatch[0], "") : line;
  rest = rest
    .replace(/\s*\|\s*/g, " | ")
    .replace(/\|(\s*\|)+/g, "|")
    .replace(/^\s*\|\s*|\s*\|\s*$/g, "")
    .trim();

  const emSplit = rest.split(/\s+[—–]\s+/);
  if (emSplit.length >= 2) {
    const company = emSplit[0].trim();
    const rightParts = emSplit
      .slice(1)
      .join(" — ")
      .split(/\s+\|\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const title = rightParts[0] || company;
    const location = rightParts.find(
      (p) => p !== title && (isLocationLine(p) || /remote|onsite|hybrid/i.test(p)),
    );
    return {
      company: dedupeText(company),
      title: dedupeText(title),
      location: location ? dedupeText(location) : undefined,
      start,
      end: end || "Present",
    };
  }

  const parts = rest
    .split(/\s+\|\s+|\s+·\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  let title = parts[0] || rest;
  let company = parts[1] || parts[0] || rest;
  if (
    parts.length >= 2 &&
    /pvt|ltd|inc|llc|corp|company|federal|security|labs|web|infoservices/i.test(parts[1])
  ) {
    title = parts[0];
    company = parts[1];
  } else if (
    parts.length >= 2 &&
    /representative|engineer|developer|associate|executive|manager|analyst/i.test(parts[0])
  ) {
    title = parts[0];
    company = parts[1];
  } else if (
    parts.length >= 2 &&
    /representative|engineer|developer|associate|executive|manager|analyst/i.test(parts[1])
  ) {
    company = parts[0];
    title = parts[1];
  }
  const location = parts.find(
    (p) =>
      p !== title &&
      p !== company &&
      (isLocationLine(p) || /remote|onsite|hybrid/i.test(p)),
  );

  return {
    company: dedupeText(company),
    title: dedupeText(title),
    location: location ? dedupeText(location) : undefined,
    start,
    end: end || "Present",
  };
}

function parseProjects(lines: string[]): StructuredResume["projects"] {
  const projects: StructuredResume["projects"] = [];
  let current: { name: string; url?: string; bullets: string[] } | null = null;

  const push = () => {
    if (!current) return;
    if (current.name && (current.bullets.length || current.url)) {
      projects.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    if (/^[-•*]/.test(line)) {
      if (current) current.bullets.push(line.replace(/^[-•*]\s*/, "").trim());
      continue;
    }
    push();
    const urlMatch = line.match(/https?:\/\/[^\s)]+/i);
    let name = line
      .replace(/https?:\/\/[^\s)]+/gi, "")
      .replace(/^\[|\]$/g, "")
      .replace(/\s*[—–:|]\s*$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    // "Opseno: SaaS Business OS" → name Opseno, rest as first bullet hint
    const colon = name.match(/^([^:]{2,60}):\s+(.+)$/);
    let firstBullet: string | undefined;
    if (colon) {
      name = colon[1].trim();
      firstBullet = colon[2].trim();
    }
    if (!name || name.length > 120) continue;
    current = {
      name: dedupeText(name),
      url: urlMatch ? normalizeUrl(urlMatch[0]) : undefined,
      bullets: firstBullet ? [firstBullet] : [],
    };
  }
  push();
  return projects;
}

function heuristicDraft(rawText: string, links: ResumeLink[]): StructuredResume {
  const draft = emptyResume();
  let text = rawText.replace(/\r/g, "");
  text = text.replace(/\bCORE SKILLS\b[:\s]*/i, "\nCORE SKILLS\n");

  const lines = uniqueLines(
    text
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map(dedupeText),
  );

  draft.contact.fullName = dedupeText(lines[0] || "Your Name").slice(0, 80);
  const email = rawText.match(EMAIL_RE)?.[0];
  if (email) draft.contact.email = email;
  const phone = rawText.match(PHONE_RE)?.[0];
  if (phone && phone.replace(/\D/g, "").length >= 8) {
    draft.contact.phone = phone.trim();
  }

  const scrubContactBits = (s: string) =>
    dedupeText(
      s
        .replace(EMAIL_RE, "")
        .replace(PHONE_RE, "")
        .replace(/\s*[·|]+\s*/g, ", ")
        .replace(/,\s*,+/g, ",")
        .replace(/\s{2,}/g, " ")
        .replace(/^,\s*|,\s*$/g, "")
        .trim(),
    );

  if (lines[1] && isLocationLine(lines[1])) {
    draft.contact.location = scrubContactBits(lines[1]);
  } else if (isLocationLine(lines[0] || "")) {
    draft.contact.location = scrubContactBits(lines[0]);
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
    ignore: [],
  };

  let current = "preamble";
  for (const line of lines.slice(1)) {
    if (EMAIL_RE.test(line) || PHONE_RE.test(line)) continue;
    if (isLocationLine(line) && current === "preamble") {
      if (!draft.contact.location) draft.contact.location = dedupeText(line);
      continue;
    }
    const section = isSectionHeader(line);
    if (section) {
      current = section;
      continue;
    }
    if (current === "ignore") continue;
    buckets[current].push(line);
  }

  if (buckets.preamble.length) {
    const maybeHeadline = buckets.preamble.find(
      (l) => !isLocationLine(l) && !EMAIL_RE.test(l) && l.length < 120,
    );
    draft.headline = maybeHeadline?.slice(0, 140) || "";
    if (!buckets.summary.length) {
      draft.summary = buckets.preamble
        .filter((l) => l !== maybeHeadline && !isLocationLine(l))
        .join(" ")
        .slice(0, 700);
    }
  }

  if (buckets.summary.length) {
    draft.summary = buckets.summary.join(" ").slice(0, 900);
  }

  const coreSplit = draft.summary.split(/\bCORE SKILLS\b/i);
  if (coreSplit.length > 1) {
    draft.summary = coreSplit[0].trim();
    buckets.skills.unshift(coreSplit.slice(1).join(" ").trim());
  }

  if (buckets.skills.length) {
    draft.skills = buckets.skills.map(parseSkillLine).filter((g) => g.items.length);
  }

  if (buckets.certifications.length) {
    draft.certifications = uniqueLines(buckets.certifications);
  }

  if (buckets.education.length) {
    const eduLines = buckets.education.filter((l) => !/^[-•*]/.test(l));
    draft.education = eduLines.map((line) => {
      const clean = dedupeText(line.replace(/^[-•*]\s*/, ""));
      const pipe = clean.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean);
      const main = pipe[0] || clean;
      const dates =
        pipe.find((b) => /\d{4}/.test(b) && /present|\d{4}\s*[–—-]/i.test(b)) ||
        pipe.find((b) => /\d{4}/.test(b)) ||
        "";
      const details =
        pipe.filter((b) => b !== main && b !== dates).join(" · ") || undefined;
      const bits = main.split(/\s+[—–]\s+/).map((s) => s.trim()).filter(Boolean);
      return {
        school: bits[1] || bits[0] || main,
        degree: bits[0] || main,
        dates,
        details,
      };
    });
    const seen = new Set<string>();
    draft.education = draft.education.filter((e) => {
      const k = normKey(`${e.degree}|${e.school}|${e.dates}`);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
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

    const pushJob = () => {
      if (!currentJob) return;
      currentJob.company = dedupeText(currentJob.company);
      currentJob.title = dedupeText(currentJob.title);
      if (currentJob.location) currentJob.location = dedupeText(currentJob.location);
      currentJob.bullets = uniqueLines(currentJob.bullets.map(dedupeText));
      if (isLocationLine(currentJob.company) && isLocationLine(currentJob.title)) {
        currentJob = null;
        return;
      }
      const hasRole =
        /\b(engineer|developer|representative|associate|manager|analyst|intern|executive|specialist|admin|lead|architect|consultant|officer|agent)\b/i.test(
          `${currentJob.title} ${currentJob.company}`,
        );
      if (!hasRole && !currentJob.start && currentJob.bullets.length <= 1) {
        currentJob = null;
        return;
      }
      draft.experience.push(currentJob);
      currentJob = null;
    };

    for (const line of buckets.experience) {
      if (/^[-•*]/.test(line)) {
        if (currentJob) currentJob.bullets.push(line.replace(/^[-•*]\s*/, ""));
        continue;
      }
      if (isLocationLine(line)) {
        if (currentJob && !currentJob.location) currentJob.location = dedupeText(line);
        continue;
      }
      if (isDateOnlyLine(line)) {
        const dateMatch = line.match(
          /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*[–—-]\s*(Present|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})/i,
        );
        if (currentJob && dateMatch) {
          currentJob.start = dateMatch[1];
          currentJob.end = dateMatch[2];
        }
        continue;
      }
      if (!looksLikeJobHeader(line)) {
        continue;
      }
      pushJob();
      currentJob = { ...parseJobHeader(line), bullets: [] };
    }
    pushJob();

    const seenJobs = new Set<string>();
    draft.experience = draft.experience.filter((j) => {
      const k = normKey(`${j.company}|${j.title}|${j.start}|${j.end}`);
      if (seenJobs.has(k)) return false;
      seenJobs.add(k);
      return true;
    });
  }

  if (buckets.projects.length) {
    draft.projects = parseProjects(buckets.projects);
  }

  if (!draft.summary) {
    draft.summary = lines.slice(1, 6).join(" ").slice(0, 600);
  }
  draft.summary = dedupeText(draft.summary);

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
    return { rawText, links, draft: heuristicDraft(rawText, links) };
  }

  if (lower.endsWith(".pdf") || type.includes("pdf")) {
    const data = new Uint8Array(buffer);
    const { text } = await extractText(data, { mergePages: true });
    const rawText = (Array.isArray(text) ? text.join("\n") : String(text || "")).trim();
    const links = extractLinksFromText(rawText);
    return { rawText, links, draft: heuristicDraft(rawText, links) };
  }

  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".markdown") ||
    type.startsWith("text/")
  ) {
    const rawText = buffer.toString("utf8").trim();
    const links = extractLinksFromText(rawText);
    return { rawText, links, draft: heuristicDraft(rawText, links) };
  }

  throw new Error("Unsupported file type. Use PDF, DOCX, TXT, or MD.");
}

export function parseResumeText(rawText: string): ParseResult {
  const text = rawText.trim();
  if (!text) throw new Error("Resume text is empty");
  const links = extractLinksFromText(text);
  return { rawText: text, links, draft: heuristicDraft(text, links) };
}

export { MAX_BYTES };

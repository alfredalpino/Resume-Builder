import mammoth from "mammoth";
import { extractText } from "unpdf";
import type { ResumeLink, StructuredResume } from "@/lib/schema";
import { emptyResume } from "@/lib/schema";

const MAX_BYTES = 5 * 1024 * 1024;

const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}/;

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
  draft.summary = lines.slice(1, 6).join(" ").slice(0, 600);
  draft.headline = lines[1]?.slice(0, 120) || "";
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
    const rawText = (Array.isArray(text) ? text.join("\n") : String(text || "")).trim();
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

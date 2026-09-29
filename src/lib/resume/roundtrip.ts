/**
 * Export round-trip validation (R&D Experiment D).
 * Build PDF from IR → re-parse → compare key fields → report loss.
 */
import { buildPdfBuffer } from "@/lib/export/pdf";
import { parseResumeBuffer } from "@/lib/parse";
import { resumeToPlainText, type StructuredResume } from "@/lib/schema";
import { normalize } from "@/lib/nlp";
import {
  DEFAULT_RESUME_STYLE,
  type ResumeStyle,
} from "@/lib/style";

export type RoundTripCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type RoundTripReport = {
  ok: boolean;
  score: number;
  checks: RoundTripCheck[];
  extractedName?: string;
  textLength: number;
  irTextLength: number;
};

function includesNorm(haystack: string, needle: string): boolean {
  const n = normalize(needle);
  if (!n || n.length < 2) return true;
  return normalize(haystack).includes(n);
}

export async function validatePdfRoundTrip(
  resume: StructuredResume,
  style: ResumeStyle = DEFAULT_RESUME_STYLE,
): Promise<RoundTripReport> {
  const buffer = await buildPdfBuffer(resume, style);
  const parsed = await parseResumeBuffer(
    buffer,
    "roundtrip.pdf",
    "application/pdf",
  );
  const text = parsed.rawText || "";
  const draft = parsed.draft;
  const checks: RoundTripCheck[] = [];

  const name = resume.contact.fullName;
  const nameOk =
    Boolean(name) &&
    name !== "Your Name" &&
    (includesNorm(text, name) || includesNorm(draft.contact.fullName, name));
  checks.push({
    key: "name",
    label: "Full name",
    ok: nameOk,
    detail: nameOk ? draft.contact.fullName || name : "Name not found in exported PDF text",
  });

  if (resume.contact.email) {
    const ok = includesNorm(text, resume.contact.email) || draft.contact.email === resume.contact.email;
    checks.push({
      key: "email",
      label: "Email",
      ok,
      detail: ok ? undefined : "Email missing from PDF extract",
    });
  }

  if (resume.contact.phone) {
    const digits = resume.contact.phone.replace(/\D/g, "");
    const ok =
      digits.length < 8 ||
      text.replace(/\D/g, "").includes(digits.slice(-8)) ||
      (draft.contact.phone || "").replace(/\D/g, "").includes(digits.slice(-8));
    checks.push({
      key: "phone",
      label: "Phone",
      ok,
      detail: ok ? undefined : "Phone digits missing from PDF extract",
    });
  }

  if (resume.summary && resume.summary.length > 40) {
    const snippet = resume.summary.slice(0, 48);
    const ok = includesNorm(text, snippet) || includesNorm(draft.summary || "", snippet);
    checks.push({
      key: "summary",
      label: "Summary",
      ok,
      detail: ok ? undefined : "Summary text lost or reordered poorly",
    });
  }

  const skillItems = resume.skills.flatMap((g) => g.items).slice(0, 8);
  if (skillItems.length) {
    const hit = skillItems.filter((s) => includesNorm(text, s)).length;
    const ok = hit / skillItems.length >= 0.5;
    checks.push({
      key: "skills",
      label: "Skills coverage",
      ok,
      detail: `${hit}/${skillItems.length} sampled skills found in PDF text`,
    });
  }

  if (resume.experience[0]) {
    const job = resume.experience[0];
    const ok =
      includesNorm(text, job.company) ||
      includesNorm(text, job.title) ||
      draft.experience.some(
        (j) =>
          includesNorm(j.company, job.company) || includesNorm(j.title, job.title),
      );
    checks.push({
      key: "experience",
      label: "First role",
      ok,
      detail: ok
        ? `${job.company} — ${job.title}`
        : "First experience block not recovered from PDF",
    });
  }

  if (resume.education[0]) {
    const edu = resume.education[0];
    const ok =
      includesNorm(text, edu.school) ||
      includesNorm(text, edu.degree) ||
      draft.education.some(
        (e) =>
          includesNorm(e.school, edu.school) || includesNorm(e.degree, edu.degree),
      );
    checks.push({
      key: "education",
      label: "Education",
      ok,
      detail: ok ? undefined : "Education not found in PDF extract",
    });
  }

  for (const link of resume.contact.links.slice(0, 3)) {
    const host = link.url.replace(/^https?:\/\//i, "").split("/")[0];
    const ok = includesNorm(text, host) || includesNorm(text, link.url);
    checks.push({
      key: `link_${host}`,
      label: `Link (${link.label})`,
      ok,
      detail: ok ? undefined : `${host} not found as plain text/URL in PDF`,
    });
  }

  const passed = checks.filter((c) => c.ok).length;
  const score = checks.length
    ? Math.round((passed / checks.length) * 100)
    : 100;

  return {
    ok: score >= 70,
    score,
    checks,
    extractedName: draft.contact.fullName,
    textLength: text.length,
    irTextLength: resumeToPlainText(resume).length,
  };
}

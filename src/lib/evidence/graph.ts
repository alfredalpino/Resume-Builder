/**
 * Candidate Evidence Graph — R&D §38 / §43.
 * Extract atomic claims from StructuredResume IR and compare tailored vs source.
 */
import { z } from "zod";
import { normalize } from "@/lib/nlp";
import type { StructuredResume } from "@/lib/schema";

export const EvidenceKindSchema = z.enum([
  "contact",
  "skill",
  "experience_bullet",
  "employer",
  "title",
  "education",
  "project",
  "certification",
  "award",
  "summary",
  "headline",
]);

export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidenceItemSchema = z.object({
  id: z.string(),
  claim: z.string(),
  sourceSection: EvidenceKindSchema,
  originalText: z.string(),
  normalizedConcept: z.string(),
  confidence: z.number().min(0).max(1),
  explicitOrInferred: z.enum(["explicit", "inferred"]),
  userConfirmed: z.boolean().default(false),
  createdAt: z.string(),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export type ClaimStatus =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "UNSUPPORTED"
  | "NEW_CLAIM";

export type ClaimIntegrityRow = {
  claim: string;
  section: EvidenceKind;
  status: ClaimStatus;
  matchedEvidenceIds: string[];
  note?: string;
};

export type ClaimIntegrityReport = {
  supported: number;
  partial: number;
  unsupported: number;
  newClaims: number;
  rows: ClaimIntegrityRow[];
  integrityScore: number;
  summary: string;
};

function idFor(section: string, text: string, idx: number): string {
  const slug = normalize(text).slice(0, 40).replace(/\s+/g, "_") || "x";
  return `${section}_${idx}_${slug}`;
}

/** Build evidence graph nodes from a resume IR. */
export function extractEvidenceGraph(resume: StructuredResume): EvidenceItem[] {
  const now = new Date().toISOString();
  const items: EvidenceItem[] = [];
  let i = 0;

  const push = (
    section: EvidenceKind,
    text: string,
    confidence = 1,
    kind: "explicit" | "inferred" = "explicit",
  ) => {
    const claim = text.trim();
    if (!claim) return;
    items.push({
      id: idFor(section, claim, i++),
      claim,
      sourceSection: section,
      originalText: claim,
      normalizedConcept: normalize(claim),
      confidence,
      explicitOrInferred: kind,
      userConfirmed: false,
      createdAt: now,
    });
  };

  if (resume.contact.fullName && resume.contact.fullName !== "Your Name") {
    push("contact", resume.contact.fullName);
  }
  if (resume.contact.email) push("contact", resume.contact.email);
  if (resume.headline) push("headline", resume.headline, 0.9);
  if (resume.summary) push("summary", resume.summary, 0.85);

  for (const g of resume.skills) {
    for (const item of g.items) push("skill", item);
  }

  for (const job of resume.experience) {
    if (job.company) push("employer", job.company);
    if (job.title) push("title", `${job.title} @ ${job.company}`);
    for (const b of job.bullets) push("experience_bullet", b);
  }

  for (const e of resume.education) {
    push("education", `${e.degree} — ${e.school}${e.dates ? ` (${e.dates})` : ""}`);
  }

  for (const p of resume.projects) {
    push("project", p.name);
    for (const b of p.bullets) push("project", b, 0.9);
  }

  for (const c of resume.certifications) push("certification", c);
  for (const a of resume.awards || []) push("award", a);

  return items;
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(normalize(a).split(/\s+/).filter((t) => t.length > 2));
  const tb = new Set(normalize(b).split(/\s+/).filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.max(ta.size, tb.size);
}

function bestMatch(
  claim: string,
  evidence: EvidenceItem[],
): { item: EvidenceItem; score: number } | null {
  let best: { item: EvidenceItem; score: number } | null = null;
  const cn = normalize(claim);
  for (const e of evidence) {
    let score = 0;
    if (e.normalizedConcept === cn) score = 1;
    else if (e.normalizedConcept.includes(cn) || cn.includes(e.normalizedConcept)) {
      score = 0.85;
    } else {
      score = tokenOverlap(claim, e.claim);
    }
    if (!best || score > best.score) best = { item: e, score };
  }
  return best;
}

/**
 * Compare tailored resume claims against source evidence graph.
 * NEW_CLAIM / UNSUPPORTED = not grounded in source (integrity risk).
 */
export function buildClaimIntegrityReport(
  source: StructuredResume,
  tailored: StructuredResume,
): ClaimIntegrityReport {
  const evidence = extractEvidenceGraph(source);
  const tailoredClaims = extractEvidenceGraph(tailored);

  const rows: ClaimIntegrityRow[] = [];

  for (const tc of tailoredClaims) {
    // Identity fields: email/name continuity
    if (tc.sourceSection === "contact") {
      const match = evidence.find(
        (e) =>
          e.sourceSection === "contact" &&
          (e.normalizedConcept === tc.normalizedConcept ||
            tokenOverlap(e.claim, tc.claim) > 0.7),
      );
      rows.push({
        claim: tc.claim,
        section: tc.sourceSection,
        status: match ? "SUPPORTED" : "NEW_CLAIM",
        matchedEvidenceIds: match ? [match.id] : [],
        note: match ? undefined : "Contact field changed from source",
      });
      continue;
    }

    const best = bestMatch(tc.claim, evidence);
    if (!best || best.score < 0.25) {
      rows.push({
        claim: tc.claim,
        section: tc.sourceSection,
        status: "UNSUPPORTED",
        matchedEvidenceIds: [],
        note: "No supporting evidence on source resume",
      });
    } else if (best.score >= 0.72) {
      rows.push({
        claim: tc.claim,
        section: tc.sourceSection,
        status: "SUPPORTED",
        matchedEvidenceIds: [best.item.id],
      });
    } else if (best.score >= 0.4) {
      rows.push({
        claim: tc.claim,
        section: tc.sourceSection,
        status: "PARTIALLY_SUPPORTED",
        matchedEvidenceIds: [best.item.id],
        note: `Weak match to: ${best.item.claim.slice(0, 80)}`,
      });
    } else {
      rows.push({
        claim: tc.claim,
        section: tc.sourceSection,
        status: "NEW_CLAIM",
        matchedEvidenceIds: best ? [best.item.id] : [],
        note: "Likely invented or heavily rewritten",
      });
    }
  }

  const supported = rows.filter((r) => r.status === "SUPPORTED").length;
  const partial = rows.filter((r) => r.status === "PARTIALLY_SUPPORTED").length;
  const unsupported = rows.filter((r) => r.status === "UNSUPPORTED").length;
  const newClaims = rows.filter((r) => r.status === "NEW_CLAIM").length;
  const total = rows.length || 1;
  const integrityScore = Math.round(
    ((supported + partial * 0.5) / total) * 100,
  );

  const summary =
    integrityScore >= 80
      ? "Strong evidence grounding — most tailored claims map to your source resume."
      : integrityScore >= 55
        ? "Mixed grounding — review new/unsupported claims before applying."
        : "Weak grounding — many claims are not evidenced on your source resume.";

  return {
    supported,
    partial,
    unsupported,
    newClaims,
    rows,
    integrityScore,
    summary,
  };
}

/** Soft gate: drop unsupported experience bullets / skills when integrity mode is on. */
export function applyIntegrityGate(
  source: StructuredResume,
  tailored: StructuredResume,
): { resume: StructuredResume; removed: number; report: ClaimIntegrityReport } {
  const report = buildClaimIntegrityReport(source, tailored);
  const next = structuredClone(tailored);
  let removed = 0;

  const badSkills = new Set(
    report.rows
      .filter(
        (r) =>
          r.section === "skill" &&
          (r.status === "UNSUPPORTED" || r.status === "NEW_CLAIM"),
      )
      .map((r) => normalize(r.claim)),
  );

  next.skills = next.skills
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        const bad = badSkills.has(normalize(item));
        if (bad) removed += 1;
        return !bad;
      }),
    }))
    .filter((g) => g.items.length);

  const badBullets = new Set(
    report.rows
      .filter(
        (r) =>
          r.section === "experience_bullet" &&
          (r.status === "UNSUPPORTED" || r.status === "NEW_CLAIM"),
      )
      .map((r) => normalize(r.claim)),
  );

  next.experience = next.experience.map((job) => ({
    ...job,
    bullets: job.bullets.filter((b) => {
      const bad = badBullets.has(normalize(b));
      if (bad) removed += 1;
      return !bad;
    }),
  }));

  return {
    resume: next,
    removed,
    report: buildClaimIntegrityReport(source, next),
  };
}

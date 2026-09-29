/**
 * Alfred ATS Robustness — product metric from R&D dossier §33.
 * NOT a claim about Workday/Greenhouse/Oracle proprietary scoring.
 *
 * Weights:
 * 25% Parseability
 * 20% Structure
 * 20% Requirement coverage
 * 15% Evidence integrity
 * 10% Terminology consistency
 * 10% Export integrity
 */
import {
  analyzeJobDescription,
  normalize,
  termInText,
  type JdAnalysis,
} from "@/lib/nlp";
import { resumeToPlainText, type StructuredResume } from "@/lib/schema";

export type AtsRobustnessComponent = {
  key: string;
  label: string;
  score: number;
  weight: number;
  notes: string[];
};

export type AtsRobustnessReport = {
  /** 0–100 overall Alfred ATS Robustness */
  overall: number;
  label: "ATS Robustness";
  disclaimer: string;
  components: AtsRobustnessComponent[];
  status: "excellent" | "strong" | "fair" | "needs_work";
};

const DISCLAIMER =
  "Alfred ATS Robustness — parseability & job-alignment readiness across common ATS patterns. Not a universal vendor score.";

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

function scoreParseability(resume: StructuredResume): AtsRobustnessComponent {
  const notes: string[] = [];
  let pts = 0;
  const contact = resume.contact;

  if (contact.fullName && contact.fullName !== "Your Name") {
    pts += 20;
  } else {
    notes.push("Add a clear full name in the body (not only a header image)");
  }
  if (contact.email) pts += 18;
  else notes.push("Include an email ATS can extract");
  if (contact.phone) pts += 12;
  else notes.push("Include a phone number");
  if (contact.location) pts += 10;

  // Single-column structured text — our renderer is always machine-readable
  pts += 25;
  notes.push("Single-column, text-based layout");

  if (contact.links.some((l) => /^https?:\/\//i.test(l.url))) {
    pts += 15;
  } else {
    notes.push("Add at least one https:// profile link");
  }

  return {
    key: "parseability",
    label: "Parseability",
    score: clamp(pts),
    weight: 25,
    notes,
  };
}

function scoreStructure(resume: StructuredResume): AtsRobustnessComponent {
  const notes: string[] = [];
  let pts = 0;

  if (resume.summary && resume.summary.length > 40) {
    pts += 20;
  } else {
    notes.push("Add a professional summary");
  }
  if (resume.skills.some((g) => g.items.length > 0)) {
    pts += 20;
  } else {
    notes.push("Add a skills section");
  }
  if (resume.experience.length > 0) {
    pts += 25;
    const dated = resume.experience.filter((j) => j.start || j.end).length;
    pts += Math.round((dated / resume.experience.length) * 15);
    if (dated < resume.experience.length) {
      notes.push("Some roles are missing dates");
    }
  } else {
    notes.push("Add professional experience");
  }
  if (resume.education.length > 0) pts += 12;
  else notes.push("Add education");

  const hasBullets = resume.experience.some((j) => j.bullets.length > 0);
  if (hasBullets) pts += 8;
  else notes.push("Add accomplishment bullets under experience");

  return {
    key: "structure",
    label: "Structure",
    score: clamp(pts),
    weight: 20,
    notes,
  };
}

function scoreRequirementCoverage(
  resume: StructuredResume,
  jdText: string,
  analysis?: JdAnalysis,
): AtsRobustnessComponent {
  const analyzed = analysis ?? analyzeJobDescription(jdText);
  const text = normalize(resumeToPlainText(resume));
  const terms = [
    ...analyzed.mustHave,
    ...analyzed.tools,
    ...analyzed.keywords.slice(0, 20),
  ];
  const uniq = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
  const notes: string[] = [];

  if (!uniq.length || !jdText.trim()) {
    return {
      key: "requirement_coverage",
      label: "Requirement coverage",
      score: 55,
      weight: 20,
      notes: ["Paste a job description to measure coverage"],
    };
  }

  let hit = 0;
  const missing: string[] = [];
  for (const t of uniq) {
    if (termInText(t, text)) hit += 1;
    else missing.push(t);
  }
  const ratio = hit / uniq.length;
  const score = clamp(Math.round(ratio * 100));
  if (missing.length) {
    notes.push(`Gaps: ${missing.slice(0, 6).join(", ")}`);
  } else {
    notes.push("Strong overlap with JD must-haves and tools");
  }

  return {
    key: "requirement_coverage",
    label: "Requirement coverage",
    score,
    weight: 20,
    notes,
  };
}

function scoreEvidenceIntegrity(
  tailored: StructuredResume,
  source?: StructuredResume | null,
): AtsRobustnessComponent {
  const notes: string[] = [];
  if (!source) {
    return {
      key: "evidence_integrity",
      label: "Evidence integrity",
      score: 78,
      weight: 15,
      notes: ["Source resume unavailable for full claim check"],
    };
  }

  let pts = 40;
  // Contact continuity
  if (
    normalize(tailored.contact.email) === normalize(source.contact.email) ||
    !source.contact.email
  ) {
    pts += 15;
  } else {
    notes.push("Email changed from source");
  }

  const sourceCompanies = new Set(
    source.experience.map((j) => normalize(j.company)).filter(Boolean),
  );
  const kept = tailored.experience.filter((j) =>
    sourceCompanies.has(normalize(j.company)),
  ).length;
  if (source.experience.length === 0) {
    pts += 25;
  } else {
    const keepRatio = kept / source.experience.length;
    pts += Math.round(keepRatio * 30);
    if (keepRatio < 0.5) {
      notes.push("Several employers from the source resume were dropped");
    }
  }

  if (source.education.length && tailored.education.length) pts += 15;
  else if (!source.education.length) pts += 15;
  else notes.push("Education section changed substantially");

  if (pts >= 85) notes.push("Core identity and employers preserved");

  return {
    key: "evidence_integrity",
    label: "Evidence integrity",
    score: clamp(pts),
    weight: 15,
    notes,
  };
}

function scoreTerminology(
  resume: StructuredResume,
  analysis?: JdAnalysis,
): AtsRobustnessComponent {
  const notes: string[] = [];
  let pts = 50;
  const skillItems = resume.skills.flatMap((g) => g.items);
  const body = normalize(
    [
      resume.summary,
      ...resume.experience.flatMap((j) => j.bullets),
      resume.headline,
    ].join(" "),
  );

  if (skillItems.length >= 4) pts += 15;
  else notes.push("Expand skills so ATS can index them");

  const echoed = skillItems.filter((s) => termInText(s, body)).length;
  if (skillItems.length) {
    pts += Math.round((echoed / skillItems.length) * 25);
    if (echoed / skillItems.length < 0.3) {
      notes.push("Echo key skills inside experience bullets");
    }
  }

  if (analysis?.titleHints[0] && resume.headline) {
    if (termInText(analysis.titleHints[0], normalize(resume.headline))) {
      pts += 10;
    } else {
      notes.push("Align headline toward the target role title");
    }
  } else {
    pts += 5;
  }

  return {
    key: "terminology",
    label: "Terminology consistency",
    score: clamp(pts),
    weight: 10,
    notes,
  };
}

function scoreExportIntegrity(resume: StructuredResume): AtsRobustnessComponent {
  const notes: string[] = [];
  let pts = 40;

  if (resume.contact.fullName && resume.contact.fullName !== "Your Name") pts += 15;
  if (resume.contact.email) pts += 10;
  const badLinks = resume.contact.links.filter(
    (l) => l.url && !/^https?:\/\//i.test(l.url),
  );
  if (resume.contact.links.length && badLinks.length === 0) {
    pts += 20;
    notes.push("Profile links are clickable https URLs");
  } else if (badLinks.length) {
    notes.push("Fix links to use https://");
  } else {
    pts += 8;
  }

  const projectsOk = resume.projects.every((p) => !p.url || /^https?:\/\//i.test(p.url));
  if (projectsOk) pts += 15;
  else notes.push("Project URLs should be absolute https links");

  // Structured export path (react-pdf / docx) — always available for this schema
  pts += 10;
  notes.push("Exports as machine-readable PDF/DOCX");

  return {
    key: "export_integrity",
    label: "Export integrity",
    score: clamp(pts),
    weight: 10,
    notes,
  };
}

export function computeAtsRobustness(input: {
  resume: StructuredResume;
  jobDescription?: string;
  analysis?: JdAnalysis;
  source?: StructuredResume | null;
}): AtsRobustnessReport {
  const jd = input.jobDescription || "";
  const components: AtsRobustnessComponent[] = [
    scoreParseability(input.resume),
    scoreStructure(input.resume),
    scoreRequirementCoverage(input.resume, jd, input.analysis),
    scoreEvidenceIntegrity(input.resume, input.source),
    scoreTerminology(input.resume, input.analysis),
    scoreExportIntegrity(input.resume),
  ];

  const overall = Math.round(
    components.reduce((s, c) => s + (c.score * c.weight) / 100, 0),
  );

  const status: AtsRobustnessReport["status"] =
    overall >= 90
      ? "excellent"
      : overall >= 78
        ? "strong"
        : overall >= 60
          ? "fair"
          : "needs_work";

  return {
    overall: clamp(overall),
    label: "ATS Robustness",
    disclaimer: DISCLAIMER,
    components,
    status,
  };
}

import { z } from "zod";

/** Candidate-controlled resume / letter look. */
export const ResumeTemplateIdSchema = z.enum(["classic", "compact", "executive"]);
export type ResumeTemplateId = z.infer<typeof ResumeTemplateIdSchema>;

export const ResumeStyleSchema = z.object({
  template: ResumeTemplateIdSchema.default("classic"),
  fontFamily: z.enum(["helvetica", "times", "courier"]).default("helvetica"),
  /** Body font size in points (PDF/DOCX). Preview scales similarly. */
  fontSize: z.number().min(8).max(12).default(10),
  showHeadline: z.boolean().default(true),
  /** Page padding in points (PDF). */
  pagePadding: z.number().min(24).max(56).default(40),
  /** Section spacing multiplier (1 = default). */
  density: z.number().min(0.75).max(1.25).default(1),
});

export type ResumeStyle = z.infer<typeof ResumeStyleSchema>;

export type TemplatePreset = {
  id: ResumeTemplateId;
  label: string;
  blurb: string;
  style: ResumeStyle;
};

/** ATS-safe single-column templates — no multi-column / graphics. */
export const RESUME_TEMPLATES: TemplatePreset[] = [
  {
    id: "classic",
    label: "Classic",
    blurb: "Clean Helvetica, balanced spacing — default ATS-safe.",
    style: {
      template: "classic",
      fontFamily: "helvetica",
      fontSize: 10,
      showHeadline: true,
      pagePadding: 40,
      density: 1,
    },
  },
  {
    id: "compact",
    label: "Compact",
    blurb: "Tighter margins and type for denser one-page resumes.",
    style: {
      template: "compact",
      fontFamily: "helvetica",
      fontSize: 9,
      showHeadline: true,
      pagePadding: 28,
      density: 0.85,
    },
  },
  {
    id: "executive",
    label: "Executive",
    blurb: "Times serif, more breathing room — still single column.",
    style: {
      template: "executive",
      fontFamily: "times",
      fontSize: 10.5,
      showHeadline: true,
      pagePadding: 48,
      density: 1.1,
    },
  },
];

export const DEFAULT_RESUME_STYLE: ResumeStyle = { ...RESUME_TEMPLATES[0].style };

export function applyTemplate(id: ResumeTemplateId): ResumeStyle {
  const preset = RESUME_TEMPLATES.find((t) => t.id === id) || RESUME_TEMPLATES[0];
  return { ...preset.style };
}

export function pdfFontFamily(style: ResumeStyle): {
  regular: "Helvetica" | "Times-Roman" | "Courier";
  bold: "Helvetica-Bold" | "Times-Bold" | "Courier-Bold";
} {
  if (style.fontFamily === "times") {
    return { regular: "Times-Roman", bold: "Times-Bold" };
  }
  if (style.fontFamily === "courier") {
    return { regular: "Courier", bold: "Courier-Bold" };
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold" };
}

export function docxFontFamily(style: ResumeStyle): string {
  if (style.fontFamily === "times") return "Times New Roman";
  if (style.fontFamily === "courier") return "Courier New";
  return "Calibri";
}

/** CSS stack for live preview */
export function previewFontFamily(style: ResumeStyle): string {
  if (style.fontFamily === "times") return '"Times New Roman", Times, serif';
  if (style.fontFamily === "courier") return '"Courier New", Courier, monospace';
  return "Helvetica, Arial, sans-serif";
}

export function halfPt(points: number): number {
  return Math.round(points * 2);
}

import { z } from "zod";

/** Candidate-controlled resume / letter look. */
export const ResumeStyleSchema = z.object({
  fontFamily: z.enum(["helvetica", "times", "courier"]).default("helvetica"),
  /** Body font size in points (PDF/DOCX). Preview scales similarly. */
  fontSize: z.number().min(8).max(12).default(10),
  showHeadline: z.boolean().default(true),
});

export type ResumeStyle = z.infer<typeof ResumeStyleSchema>;

export const DEFAULT_RESUME_STYLE: ResumeStyle = {
  fontFamily: "helvetica",
  fontSize: 10,
  showHeadline: true,
};

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

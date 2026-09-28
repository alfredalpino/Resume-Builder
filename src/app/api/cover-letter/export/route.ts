import { apiError, requireSession } from "@/lib/api";
import { buildCoverLetterDocxBuffer } from "@/lib/export/docx";
import { buildCoverLetterPdfBuffer } from "@/lib/export/pdf";
import { DEFAULT_RESUME_STYLE, ResumeStyleSchema } from "@/lib/style";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const letter = String(body.letter || "").trim();
    if (!letter || letter.length < 40) return apiError("Cover letter text is required");
    const kind = String(body.kind || "pdf").toLowerCase();
    const authorName = String(body.authorName || "Candidate");
    const style = ResumeStyleSchema.catch(DEFAULT_RESUME_STYLE).parse(
      body.style ?? DEFAULT_RESUME_STYLE,
    );

    if (kind === "docx") {
      const buffer = await buildCoverLetterDocxBuffer(letter, style);
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${authorName.replace(/\s+/g, "_")}_Cover_Letter.docx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = await buildCoverLetterPdfBuffer(letter, authorName, style);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${authorName.replace(/\s+/g, "_")}_Cover_Letter.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cover letter export failed";
    return apiError(message, 400);
  }
}

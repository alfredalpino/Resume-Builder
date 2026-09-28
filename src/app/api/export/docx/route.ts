import { apiError, requireSession } from "@/lib/api";
import { buildDocxBuffer } from "@/lib/export/docx";
import { StructuredResumeSchema } from "@/lib/schema";
import { DEFAULT_RESUME_STYLE, ResumeStyleSchema } from "@/lib/style";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const resume = StructuredResumeSchema.parse(body.resume);
    const style = ResumeStyleSchema.catch(DEFAULT_RESUME_STYLE).parse(
      body.style ?? DEFAULT_RESUME_STYLE,
    );
    const buffer = await buildDocxBuffer(resume, style);
    const filename = `${resume.contact.fullName.replace(/\s+/g, "_") || "Resume"}_ATS.docx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DOCX export failed";
    return apiError(message, 400);
  }
}

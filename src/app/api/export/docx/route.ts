import { apiError, requireSession } from "@/lib/api";
import { buildDocxBuffer } from "@/lib/export/docx";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const resume = StructuredResumeSchema.parse(body.resume);
    const buffer = await buildDocxBuffer(resume);
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

import { apiError, requireSession } from "@/lib/api";
import { buildPdfBuffer } from "@/lib/export/pdf";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const resume = StructuredResumeSchema.parse(body.resume);
    const buffer = await buildPdfBuffer(resume);
    const filename = `${resume.contact.fullName.replace(/\s+/g, "_") || "Resume"}_ATS.pdf`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF export failed";
    return apiError(message, 400);
  }
}

import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { getGeminiKey, structureResumeWithGemini } from "@/lib/gemini";
import { MAX_BYTES, parseResumeBuffer, parseResumeText } from "@/lib/parse";
import { StructuredResumeSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const contentType = req.headers.get("content-type") || "";
    let rawText = "";
    let links;
    let draft;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const textField = form.get("text");

      if (file instanceof File) {
        if (file.size > MAX_BYTES) return apiError("File too large (max 5 MB)");
        const buffer = Buffer.from(await file.arrayBuffer());
        const parsed = await parseResumeBuffer(buffer, file.name, file.type);
        rawText = parsed.rawText;
        links = parsed.links;
        draft = parsed.draft;
      } else if (typeof textField === "string" && textField.trim()) {
        const parsed = parseResumeText(textField);
        rawText = parsed.rawText;
        links = parsed.links;
        draft = parsed.draft;
      } else {
        return apiError("Provide a resume file or text");
      }
    } else {
      const body = (await req.json()) as { text?: string };
      if (!body.text?.trim()) return apiError("Provide resume text");
      const parsed = parseResumeText(body.text);
      rawText = parsed.rawText;
      links = parsed.links;
      draft = parsed.draft;
    }

    const key = getGeminiKey(req);
    if (key && rawText) {
      try {
        draft = await structureResumeWithGemini(key, rawText, links);
        draft = StructuredResumeSchema.parse(draft);
        // Ensure known links survive structuring
        const existing = new Set(draft.contact.links.map((l) => l.url));
        for (const link of links) {
          if (!existing.has(link.url)) draft.contact.links.push(link);
        }
      } catch {
        // Keep heuristic draft if structuring fails
      }
    }

    return NextResponse.json({
      rawText,
      links,
      resume: draft,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse resume";
    return apiError(message, 400);
  }
}

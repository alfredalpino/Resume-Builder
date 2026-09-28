import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { getGeminiKey, validateGeminiKey } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const key = getGeminiKey(req);
  if (!key) return apiError("Missing Gemini API key header");

  let preferredModel: string | undefined;
  try {
    const body = await req.json();
    if (typeof body?.model === "string") preferredModel = body.model;
  } catch {
    // empty body is fine
  }

  try {
    const result = await validateGeminiKey(key, preferredModel);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid Gemini API key";
    return apiError(
      message.includes("API") ? message : "Invalid Gemini API key or quota exceeded",
      401,
    );
  }
}

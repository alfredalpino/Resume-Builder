import { NextResponse } from "next/server";
import { apiError, requireSession } from "@/lib/api";
import { getGeminiKey, validateGeminiKey } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const key = getGeminiKey(req);
  if (!key) return apiError("Missing Gemini API key header");

  try {
    const ok = await validateGeminiKey(key);
    if (!ok) return apiError("Gemini key validation failed", 401);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid Gemini API key";
    return apiError(message.includes("API") ? message : "Invalid Gemini API key", 401);
  }
}

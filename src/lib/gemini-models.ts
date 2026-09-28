export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-3.8-flash",
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number];

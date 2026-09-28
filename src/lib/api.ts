import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null as null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const userId = session.user.id || session.user.email || "anon";
  const limit = rateLimit(userId);
  if (!limit.ok) {
    return {
      session: null as null,
      error: NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
        },
      ),
    };
  }

  return { session, error: null as null };
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

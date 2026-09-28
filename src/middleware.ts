import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth;

  if (pathname.startsWith("/app") && !isAuthed) {
    const url = new URL("/", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const publicApi =
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/tips/leaderboard") ||
    pathname.startsWith("/api/billing/webhook");

  if (pathname.startsWith("/api/") && !publicApi && !isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/app/:path*",
    "/api/parse",
    "/api/tailor",
    "/api/score",
    "/api/export/:path*",
    "/api/cover-letter/:path*",
    "/api/billing/:path*",
    "/api/tips/:path*",
  ],
};

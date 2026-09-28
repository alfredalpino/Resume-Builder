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

  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth") &&
    !isAuthed
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/app/:path*", "/api/parse", "/api/tailor", "/api/score", "/api/validate-key", "/api/export/:path*"],
};

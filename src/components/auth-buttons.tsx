"use client";

import { signIn, signOut } from "next-auth/react";

export function SignInButton() {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/app" })}
      className="inline-flex items-center justify-center rounded-lg bg-[var(--alfred-amber)] px-5 py-2.5 text-sm font-medium text-[var(--terminal-black)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--alfred-amber)] focus:ring-offset-2 focus:ring-offset-[var(--terminal-black)]"
    >
      Tailor My Resume
    </button>
  );
}

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-md border border-[var(--terminal-border)] px-3 py-1.5 text-sm text-[var(--terminal-gray)] transition hover:border-[var(--alfred-amber)]/40 hover:text-[var(--terminal-white)]"
    >
      Sign out
    </button>
  );
}

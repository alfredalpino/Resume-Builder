import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignInButton } from "@/components/auth-buttons";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/app");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,165,36,0.08),_transparent_55%)]" />
      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm text-[var(--alfred-amber)]">&gt;_</span>
          <span className="text-sm font-semibold tracking-wide text-[var(--text)]">
            Alfred Terminal
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
          <Link href="/coffee" className="hover:text-[var(--text)]">
            Buy me a coffee
          </Link>
          <ThemeToggle />
          <SignInButton />
        </div>
      </header>

      <main className="relative mx-auto flex max-w-3xl flex-col px-6 pb-24 pt-16">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-[var(--alfred-amber)]">
          AI Application Assistant
        </p>
        <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--text)] sm:text-5xl md:text-6xl">
          Your career,
          <br />
          intelligently optimized.
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-[var(--text-secondary)]">
          Tailor your resume to the job you actually want. Generate a role-specific cover letter.
          Download ATS-ready PDF or DOCX in minutes.
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">Tailored to the job. Built for candidates.</p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <SignInButton />
          <a
            href="#how"
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:border-[var(--alfred-amber)]/40 hover:text-[var(--text)]"
          >
            See How It Works
          </a>
        </div>

        <section id="how" className="mt-24 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-medium text-[var(--text)]">Resume Tailor</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Upload your current resume and paste the job description. Alfred optimizes your
              resume for the role with Subtle, Balanced, or Aggressive tailoring.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-lg font-medium text-[var(--text)]">Cover Letter</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              One role. One relevant letter. Built from your resume and the target JD—not a generic
              template.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

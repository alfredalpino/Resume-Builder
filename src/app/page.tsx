import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/auth-buttons";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/app");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_20%,_#d7efe8_0%,_transparent_40%),radial-gradient(circle_at_80%_0%,_#f0e6d8_0%,_transparent_35%),linear-gradient(180deg,_#f7f4ef_0%,_#ebe4d8_100%)]">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(28,25,23,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(28,25,23,0.04)_1px,transparent_1px)] bg-size-[28px_28px]" />
      <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-800">
          Resume-Builder
        </p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Tailor your resume to any job. No Gemini key required.
        </h1>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-stone-600">
          Import your resume, paste a job description, and download ATS-friendly PDF and DOCX
          with clickable links. Local ATS runs on-server without quotas. Gemini is optional.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SignInButton />
          <span className="text-sm text-stone-500">Google Sign-In · Local ATS · Vercel</span>
        </div>
      </main>
    </div>
  );
}

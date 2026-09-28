import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Alfred Terminal — AI Resume Tailoring & Cover Letters",
  description:
    "Tailor your resume to specific job descriptions and generate relevant cover letters. ATS-friendly, fact-focused, and built for modern job seekers.",
  openGraph: {
    title: "Alfred Terminal — Your Career, Intelligently Optimized",
    description:
      "Tailor your resume to the job. Generate a relevant cover letter. Keep every fact true.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--bg)] font-sans text-[var(--text)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

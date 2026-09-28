"use client";

import type { CSSProperties } from "react";
import type { StructuredResume } from "@/lib/schema";
import { previewFontFamily, type ResumeStyle } from "@/lib/style";

/** CSS px width of A4 at ~96dpi (210mm). Used for fixed/desktop zoom. */
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

export function ResumePaper({
  resume,
  style,
  label,
  scale = 1,
  /** Fluid = fill container width, auto height — readable on phones. */
  fluid = false,
}: {
  resume: StructuredResume;
  style: ResumeStyle;
  label?: string;
  scale?: number;
  fluid?: boolean;
}) {
  const showHeadline = style.showHeadline && Boolean(resume.headline?.trim());

  if (fluid) {
    const css: CSSProperties = {
      fontFamily: previewFontFamily(style),
      fontSize: `${Math.max(style.fontSize, 10)}px`,
      lineHeight: 1.45,
    };
    return (
      <article
        style={css}
        className="mx-auto w-full max-w-[640px] rounded-sm bg-[var(--paper)] px-5 py-6 text-[var(--paper-text)] shadow-[var(--shadow)] sm:px-8 sm:py-8"
      >
        <PaperBody
          resume={resume}
          style={style}
          label={label}
          showHeadline={showHeadline}
        />
      </article>
    );
  }

  const css: CSSProperties = {
    fontFamily: previewFontFamily(style),
    fontSize: `${style.fontSize}px`,
    lineHeight: 1.45,
    width: A4_WIDTH_PX,
    minHeight: A4_HEIGHT_PX,
  };

  return (
    <div
      className="mx-auto origin-top"
      style={{
        width: A4_WIDTH_PX * scale,
        height: A4_HEIGHT_PX * scale,
      }}
    >
      <article
        style={{
          ...css,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="rounded-sm bg-[var(--paper)] px-10 py-9 text-[var(--paper-text)] shadow-[var(--shadow)]"
      >
        <PaperBody
          resume={resume}
          style={style}
          label={label}
          showHeadline={showHeadline}
        />
      </article>
    </div>
  );
}

function PaperBody({
  resume,
  style,
  label,
  showHeadline,
}: {
  resume: StructuredResume;
  style: ResumeStyle;
  label?: string;
  showHeadline: boolean;
}) {
  return (
    <>
      {label ? (
        <p
          className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--alfred-amber)]"
          style={{ fontSize: Math.max(8, style.fontSize - 1) }}
        >
          {label}
        </p>
      ) : null}
      <h1
        className="text-center font-bold tracking-wide"
        style={{ fontSize: style.fontSize + 7 }}
      >
        {resume.contact.fullName.toUpperCase()}
      </h1>
      {showHeadline ? (
        <p className="mt-1 text-center font-semibold" style={{ fontSize: style.fontSize + 0.5 }}>
          {resume.headline}
        </p>
      ) : null}
      <p
        className="mt-1 text-center opacity-70"
        style={{ fontSize: Math.max(8, style.fontSize - 1) }}
      >
        {[resume.contact.location, resume.contact.email, resume.contact.phone]
          .filter(Boolean)
          .join("  ·  ")}
      </p>
      {resume.summary ? (
        <>
          <h3 className="mt-4 border-b border-black/80 pb-0.5 font-bold uppercase tracking-wide">
            Professional Summary
          </h3>
          <p className="mt-1 text-justify">{resume.summary}</p>
        </>
      ) : null}
      {resume.skills.length ? (
        <>
          <h3 className="mt-3 border-b border-black/80 pb-0.5 font-bold uppercase tracking-wide">
            Skills
          </h3>
          {resume.skills.map((g) => (
            <p key={g.category} className="mt-1">
              <strong>{g.category}: </strong>
              {g.items.join(" · ")}
            </p>
          ))}
        </>
      ) : null}
      {resume.experience.length ? (
        <>
          <h3 className="mt-3 border-b border-black/80 pb-0.5 font-bold uppercase tracking-wide">
            Experience
          </h3>
          {resume.experience.map((job, idx) => (
            <div key={`${job.company}-${idx}`} className="mt-1.5">
              <p className="font-bold">
                {job.company} — {job.title}
              </p>
              <p className="opacity-60" style={{ fontSize: Math.max(8, style.fontSize - 1) }}>
                {job.start} – {job.end}
                {job.location ? `  ·  ${job.location}` : ""}
              </p>
              <ul className="mt-0.5 pl-2">
                {job.bullets.map((b, i) => (
                  <li key={i}>• {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}
      {resume.projects.length ? (
        <>
          <h3 className="mt-3 border-b border-black/80 pb-0.5 font-bold uppercase tracking-wide">
            Projects
          </h3>
          {resume.projects.map((p, idx) => (
            <div key={`${p.name}-${idx}`} className="mt-1.5">
              <p className="font-bold">{p.name}</p>
              <ul className="pl-2">
                {p.bullets.map((b, i) => (
                  <li key={i}>• {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}
      {resume.education.length ? (
        <>
          <h3 className="mt-3 border-b border-black/80 pb-0.5 font-bold uppercase tracking-wide">
            Education
          </h3>
          {resume.education.map((e, idx) => {
            const same = e.degree.trim().toLowerCase() === e.school.trim().toLowerCase();
            return (
              <p key={`${e.school}-${idx}`} className="mt-1">
                {same ? e.degree : `${e.degree} — ${e.school}`}
                {e.dates ? `  ·  ${e.dates}` : ""}
                {e.details ? `  ·  ${e.details}` : ""}
              </p>
            );
          })}
        </>
      ) : null}
      {resume.certifications.length ? (
        <>
          <h3 className="mt-3 border-b border-black/80 pb-0.5 font-bold uppercase tracking-wide">
            Certifications
          </h3>
          {resume.certifications.map((c) => (
            <p key={c} className="mt-1">
              {c}
            </p>
          ))}
        </>
      ) : null}
    </>
  );
}

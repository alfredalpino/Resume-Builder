"use client";

import { useState, type ReactNode } from "react";
import { emptyResume, type StructuredResume } from "@/lib/schema";

type Props = {
  value: StructuredResume;
  onChange: (next: StructuredResume) => void;
  onUse: () => void;
};

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--alfred-amber)]";
const labelClass = "mb-1 block text-xs font-medium text-[var(--text-muted)]";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

export function GuidedCreateForm({ value, onChange, onUse }: Props) {
  const [openJob, setOpenJob] = useState(0);

  function patch(partial: Partial<StructuredResume>) {
    onChange({ ...value, ...partial });
  }

  function patchContact(partial: Partial<StructuredResume["contact"]>) {
    onChange({ ...value, contact: { ...value.contact, ...partial } });
  }

  function updateJob(idx: number, partial: Partial<StructuredResume["experience"][0]>) {
    const experience = value.experience.map((j, i) =>
      i === idx ? { ...j, ...partial } : j,
    );
    onChange({ ...value, experience });
  }

  function addJob() {
    onChange({
      ...value,
      experience: [
        ...value.experience,
        {
          company: "",
          title: "",
          start: "",
          end: "Present",
          bullets: [""],
        },
      ],
    });
    setOpenJob(value.experience.length);
  }

  function removeJob(idx: number) {
    onChange({
      ...value,
      experience: value.experience.filter((_, i) => i !== idx),
    });
  }

  function skillsText(): string {
    if (!value.skills.length) return "";
    return value.skills
      .map((g) =>
        g.category === "Core Skills" ? g.items.join(", ") : `${g.category}: ${g.items.join(", ")}`,
      )
      .join("\n");
  }

  function setSkillsFromText(text: string) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const skills: StructuredResume["skills"] = [];
    for (const line of lines) {
      const m = line.match(/^([^:]+):\s*(.+)$/);
      if (m) {
        skills.push({
          category: m[1].trim(),
          items: m[2].split(/[,|]/).map((s) => s.trim()).filter(Boolean),
        });
      } else {
        skills.push({
          category: "Core Skills",
          items: line.split(/[,|]/).map((s) => s.trim()).filter(Boolean),
        });
      }
    }
    onChange({ ...value, skills });
  }

  const canUse =
    value.contact.fullName.trim() &&
    value.contact.fullName !== "Your Name" &&
    (value.experience.length > 0 || value.summary.length > 20);

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--text-secondary)]">
        Fill the fields. Preview updates live on the right — then use this resume to continue.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <input
            className={inputClass}
            value={value.contact.fullName === "Your Name" ? "" : value.contact.fullName}
            onChange={(e) => patchContact({ fullName: e.target.value || "Your Name" })}
            placeholder="Anas Tarique"
          />
        </Field>
        <Field label="Headline / target role">
          <input
            className={inputClass}
            value={value.headline}
            onChange={(e) => patch({ headline: e.target.value })}
            placeholder="Software Engineer"
          />
        </Field>
        <Field label="Email">
          <input
            className={inputClass}
            type="email"
            value={value.contact.email}
            onChange={(e) => patchContact({ email: e.target.value })}
            placeholder="you@email.com"
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputClass}
            value={value.contact.phone}
            onChange={(e) => patchContact({ phone: e.target.value })}
            placeholder="+91 …"
          />
        </Field>
        <Field label="Location">
          <input
            className={inputClass}
            value={value.contact.location || ""}
            onChange={(e) => patchContact({ location: e.target.value })}
            placeholder="City, Country"
          />
        </Field>
        <Field label="LinkedIn / portfolio URL">
          <input
            className={inputClass}
            value={value.contact.links[0]?.url || ""}
            onChange={(e) => {
              const url = e.target.value.trim();
              patchContact({
                links: url
                  ? [{ label: /github/i.test(url) ? "GitHub" : "LinkedIn", url: /^https?:\/\//i.test(url) ? url : `https://${url}` }]
                  : [],
              });
            }}
            placeholder="https://linkedin.com/in/…"
          />
        </Field>
      </div>

      <Field label="Professional summary">
        <textarea
          className={inputClass}
          rows={3}
          value={value.summary}
          onChange={(e) => patch({ summary: e.target.value })}
          placeholder="2–3 sentences about your background…"
        />
      </Field>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-[var(--text-muted)]">Experience</p>
          <button
            type="button"
            onClick={addJob}
            className="text-xs text-[var(--alfred-amber)] hover:underline"
          >
            + Add role
          </button>
        </div>
        {value.experience.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">No roles yet. Add your latest job.</p>
        ) : null}
        <div className="space-y-3">
          {value.experience.map((job, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm font-medium"
                onClick={() => setOpenJob(openJob === idx ? -1 : idx)}
              >
                <span>
                  {job.company || "Company"} — {job.title || "Title"}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {openJob === idx ? "Hide" : "Edit"}
                </span>
              </button>
              {openJob === idx ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Field label="Company">
                    <input
                      className={inputClass}
                      value={job.company}
                      onChange={(e) => updateJob(idx, { company: e.target.value })}
                    />
                  </Field>
                  <Field label="Title">
                    <input
                      className={inputClass}
                      value={job.title}
                      onChange={(e) => updateJob(idx, { title: e.target.value })}
                    />
                  </Field>
                  <Field label="Start">
                    <input
                      className={inputClass}
                      value={job.start}
                      onChange={(e) => updateJob(idx, { start: e.target.value })}
                      placeholder="Jan 2022"
                    />
                  </Field>
                  <Field label="End">
                    <input
                      className={inputClass}
                      value={job.end}
                      onChange={(e) => updateJob(idx, { end: e.target.value })}
                      placeholder="Present"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Bullets (one per line)">
                      <textarea
                        className={inputClass}
                        rows={4}
                        value={job.bullets.join("\n")}
                        onChange={(e) =>
                          updateJob(idx, {
                            bullets: e.target.value.split("\n").map((b) => b.trim()).filter(Boolean),
                          })
                        }
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeJob(idx)}
                    className="text-xs text-[var(--error)]"
                  >
                    Remove role
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Education (Degree — School | Year)">
          <input
            className={inputClass}
            value={
              value.education[0]
                ? `${value.education[0].degree} — ${value.education[0].school}${value.education[0].dates ? ` | ${value.education[0].dates}` : ""}`
                : ""
            }
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (!raw) {
                onChange({ ...value, education: [] });
                return;
              }
              const m = raw.match(/^(.+?)\s+[—–\-]\s+(.+?)(?:\s*[|]\s*(.+))?$/);
              const entry = {
                degree: m?.[1]?.trim() || raw,
                school: m?.[2]?.trim() || raw,
                dates: m?.[3]?.trim() || "",
              };
              onChange({ ...value, education: [entry] });
            }}
            placeholder="B.Tech CS — University | 2019"
          />
        </Field>
        <Field label="Skills (comma-separated or Category: a, b)">
          <textarea
            className={inputClass}
            rows={3}
            value={skillsText()}
            onChange={(e) => setSkillsFromText(e.target.value)}
            placeholder={"Languages: TypeScript, Python\nTools: Docker, Git"}
          />
        </Field>
      </div>

      <Field label="Projects (Name | url, then bullets on following lines in notes — or one line name)">
        <input
          className={inputClass}
          value={value.projects[0]?.name || ""}
          onChange={(e) => {
            const name = e.target.value.trim();
            onChange({
              ...value,
              projects: name
                ? [{ name, url: value.projects[0]?.url, bullets: value.projects[0]?.bullets || [] }]
                : [],
            });
          }}
          placeholder="Portfolio Site"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Certifications (one per line)">
          <textarea
            className={inputClass}
            rows={2}
            value={(value.certifications || []).join("\n")}
            onChange={(e) =>
              patch({
                certifications: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </Field>
        <Field label="Awards (one per line)">
          <textarea
            className={inputClass}
            rows={2}
            value={(value.awards || []).join("\n")}
            onChange={(e) =>
              patch({
                awards: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </Field>
      </div>

      <button
        type="button"
        disabled={!canUse}
        onClick={onUse}
        className="h-11 w-full rounded-lg bg-[var(--alfred-amber)] px-5 text-sm font-semibold text-[var(--bg)] disabled:opacity-50 sm:w-auto"
      >
        Use this resume
      </button>
    </div>
  );
}

export function blankGuidedResume(): StructuredResume {
  return emptyResume();
}

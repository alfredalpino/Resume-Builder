/**
 * Golden fixture: Anas BPO PDF → Hard tailor quality gates.
 * Run: npx tsx scripts/golden-anas.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { parseResumeBuffer } from "../src/lib/parse";
import { runAlfredPipeline } from "../src/lib/alfred/pipeline";

const JD = `Software Engineer at ComplyDo.
We need TypeScript, Next.js, React, Python, LangChain.
Own features end to end. Ship to production. AI / agent systems.`;

async function main() {
  const pdf = resolve(__dirname, "../../Anas_Lko_resume_BPO.pdf");
  const buf = readFileSync(pdf);
  const parsed = await parseResumeBuffer(buf, "Anas_Lko_resume_BPO.pdf", "application/pdf");
  const out = await runAlfredPipeline(parsed.draft, JD, "hard");

  const summary = out.resume.summary || "";
  const edu = out.resume.education[0];
  const skillCats = out.resume.skills.map((g) => g.category).join(",");
  const text = JSON.stringify(out.resume);

  const checks: { name: string; ok: boolean; detail?: string }[] = [
    {
      name: "summary starts with capital",
      ok: /^[A-Z]/.test(summary.trim()),
      detail: summary.slice(0, 80),
    },
    {
      name: "no coach-speak labels",
      ok: !/Transferable Strengths|Tools Already Used|Aspiring |deliberate pivot/i.test(text),
    },
    {
      name: "education not tripled",
      ok: Boolean(edu) && edu.school !== edu.degree,
      detail: JSON.stringify(edu),
    },
    {
      name: "Hard uses Core Competencies",
      ok: /Core Competencies/i.test(skillCats),
      detail: skillCats,
    },
    {
      name: "first bullet complete",
      ok: (out.resume.experience[0]?.bullets[0]?.length || 0) > 40,
      detail: out.resume.experience[0]?.bullets[0],
    },
  ];

  let failed = 0;
  for (const c of checks) {
    console.log(c.ok ? "PASS" : "FAIL", c.name, c.detail ? `— ${c.detail}` : "");
    if (!c.ok) failed++;
  }
  console.log("\nSummary:\n", summary);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

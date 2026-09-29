/**
 * Lightweight golden checks for evidence graph + master profile.
 * Run: npx tsx scripts/golden-evidence-profile.ts
 */
import { emptyResume } from "../src/lib/schema";
import {
  applyIntegrityGate,
  buildClaimIntegrityReport,
  extractEvidenceGraph,
} from "../src/lib/evidence/graph";
import {
  buildMasterProfile,
  mergeApplication,
} from "../src/lib/profile/master-profile";

const source = emptyResume();
source.contact = {
  fullName: "Anas Tarique",
  email: "anas@example.com",
  phone: "9999999999",
  location: "Lucknow",
  links: [],
};
source.summary = "Customer support professional with CRM and CSAT focus.";
source.skills = [{ category: "Core", items: ["CRM", "Communication", "Excel"] }];
source.experience = [
  {
    company: "BPO Co",
    title: "Advisor",
    start: "2022",
    end: "Present",
    bullets: ["Handled 80+ tickets daily with 95% CSAT using CRM."],
  },
];
source.education = [{ school: "Univ", degree: "BA", dates: "2021" }];

const tailored = structuredClone(source);
tailored.skills = [
  { category: "Core", items: ["TypeScript", "Next.js", "CRM", "React"] },
];
tailored.experience[0].bullets = [
  "Built production Next.js apps in TypeScript.",
  "Handled 80+ tickets daily with 95% CSAT using CRM.",
];

const evidence = extractEvidenceGraph(source);
const report = buildClaimIntegrityReport(source, tailored);
const gated = applyIntegrityGate(source, tailored);
const profile = mergeApplication(buildMasterProfile(source), {
  targetRole: "Software Engineer",
  jdSnippet: "Need TypeScript Next.js",
  matchRate: 82,
  integrityScore: report.integrityScore,
});

const checks = [
  { name: "evidence non-empty", ok: evidence.length >= 5 },
  { name: "flags new skills", ok: report.newClaims + report.unsupported > 0 },
  { name: "keeps CRM support", ok: report.supported >= 1 },
  {
    name: "gate strips invented skills",
    ok: !gated.resume.skills.some((g) =>
      g.items.some((i) => /typescript|next\.js|react/i.test(i)),
    ),
  },
  { name: "gate keeps CRM", ok: gated.resume.skills.some((g) => g.items.includes("CRM")) },
  { name: "master profile apps", ok: profile.applications.length === 1 },
];

let failed = 0;
for (const c of checks) {
  console.log(c.ok ? "PASS" : "FAIL", c.name);
  if (!c.ok) failed += 1;
}
console.log("integrityScore", report.integrityScore, "removed", gated.removed);
if (failed) process.exit(1);

# 2026-09-28 — Anas PDF parse + Hard tailor fix

## Problem
- Original Anas BPO PDF parse produced 7 "Skills:" groups, truncated bullets, and education tripled (same string in school/degree/dates).
- Hard mode invented coach-speak labels: "Transferable Strengths" / "Tools Already Used", mid-word summary cut ("and fo."), and hallucinated "User-facing UI craft".

## Fixes
- parse.ts: stitchWrappedLines, education field parser, skill subsection markers, orphan bullet rejoin, mergeSkillGroups.
- center.ts: Core Competencies + Applications taxonomy; word-boundary truncate; drop Basic Computer Operations; no Transferable Strengths.
- Preview/PDF/DOCX: avoid degree — school when identical.

## Verify
Anas_Lko_resume_BPO.pdf → 2 skill groups, edu Class 12 / NIOS / 2025 / 94%, full first bullet, Hard labels clean.

## Ship
Commit 1e823a6 pushed to alfredalpino/Resume-Builder (main).

# PRD: Jev-Powered AI Resume Optimizer & Cover Letter Builder

## 1. Product Overview

We already have a resume-building application for job seekers.

The existing product allows a candidate to:

1. Upload or paste their current resume.
2. Paste their target job description (JD).
3. Generate a tailored, ATS-friendly resume based on that JD.
4. Generate a customized cover letter with one click.

The goal of this upgrade is to integrate **Jev by TypeSafe AI** as the application's **decision and evaluation layer**.

Jev is not intended to replace the existing generative AI used for writing resumes or cover letters. Jev is designed to make structured decisions: it accepts context plus typed questions and returns structured answers such as choices, scores, probabilities, and confidence. This makes it useful for determining how the resume should be optimized before the generation model writes the final document.

Jev should therefore act as the application's **AI resume intelligence / decision engine**, while the existing LLM remains responsible for natural-language generation.

---

# 2. Core Product Concept

The upgraded workflow should be:

Candidate Resume + Target Job Description
↓
Resume/JD Parsing
↓
Jev Analysis & Decision Layer
↓
Structured Resume Optimization Plan
↓
LLM Resume Generation
↓
Jev Quality/Compliance Check
↓
Final ATS-Friendly Resume
↓
Jev Cover-Letter Strategy
↓
LLM Cover Letter Generation
↓
Final Cover Letter

The key architectural principle is:

**Jev decides WHAT should happen.  
The LLM writes HOW it should be expressed.  
Application code controls the final workflow.**

Jev should NOT be used as a general-purpose text generator.

---

# 3. Why Jev Is Useful Here

Traditional LLM-only resume builders typically ask an LLM to:

- read the resume,
- read the JD,
- determine relevance,
- identify missing skills,
- decide what to emphasize,
- rewrite the resume,
- and judge whether the result is good.

That creates an unnecessarily large and ambiguous generation task.

Instead, Jev should handle the structured decisions.

Examples:

- Is this candidate relevant to the target role?
- Which target role category does this JD belong to?
- Which requirements are explicitly satisfied?
- Which requirements are partially satisfied?
- Which requirements are missing?
- Which resume sections require optimization?
- Which skills should receive priority?
- How strong is the candidate's match?
- Does the generated resume accurately reflect the source resume?
- Is the generated resume sufficiently aligned with the JD?
- Should the system automatically finalize the document or request another generation pass?

Jev supports three relevant decision types:

- **Choice** — select one option from a predefined set.
- **Score** — evaluate something against ordered levels.
- **Noul** — probabilistic yes/no judgment.

Multiple questions can be sent together in one request, which should be used aggressively to reduce unnecessary API calls.

---

# 4. Product Goals

## Primary Goals

### G1 — Improve resume-JD matching

The system should understand the relationship between the candidate's existing resume and the target job description before rewriting anything.

### G2 — Make optimization decisions explicit

Instead of blindly asking an LLM to "make this ATS-friendly", the system should create a structured optimization plan.

### G3 — Prevent hallucinated experience

The system must never invent:

- employment history,
- job titles,
- companies,
- certifications,
- degrees,
- technologies,
- years of experience,
- achievements,
- responsibilities,
- numerical results,
- or other credentials.

Jev should help classify whether proposed resume claims are supported by the source resume.

### G4 — Improve ATS alignment

The system should identify relevant terminology, skills, qualifications, responsibilities, and role-specific concepts appearing in the JD and determine which are supported by the candidate's resume.

### G5 — Improve cover letters

The system should create a structured cover-letter strategy before the LLM generates the actual letter.

### G6 — Keep Jev inexpensive

Use Jev primarily for compact structured decisions rather than repeatedly sending large amounts of redundant text.

Jev's currently documented pricing is $0.042 per million input tokens with output tokens free; actual free-credit availability should be checked in the user's TypeSafe console rather than hard-coded into the product assumptions.

---

# 5. Non-Goals

Jev should NOT:

- generate the final resume prose;
- generate the cover letter prose;
- replace the existing LLM;
- make employment or hiring predictions;
- claim that a resume guarantees an interview;
- fabricate missing qualifications;
- automatically add skills simply because they appear in a JD;
- make unsupported claims about ATS scoring;
- decide whether a candidate "deserves" a job.

The product should provide optimization assistance, not guarantee employment outcomes.

---

# 6. Existing User Flow

The existing interface should remain simple.

## Step 1 — Upload Resume

Candidate uploads:

- PDF
- DOCX
- TXT

The system extracts the resume into structured text.

Example:

```json
{
  "candidate": {
    "name": "...",
    "contact": "..."
  },
  "summary": "...",
  "experience": [],
  "education": [],
  "skills": [],
  "certifications": [],
  "projects": []
}
```

Do not send unnecessary UI metadata to Jev.

---

# 7. Step 2 — Target Job Description

Candidate pastes the target JD.

The system extracts:

- job title;
- company;
- required skills;
- preferred skills;
- years of experience;
- education requirements;
- certifications;
- responsibilities;
- tools/technologies;
- domain terminology;
- location;
- seniority.

The extracted JD should become structured application state.

---

# 8. Step 3 — Jev Resume Intelligence Analysis

Send the relevant resume and JD state to Jev.

Example conceptual request:

```json
{
  "state": {
    "resume": "...candidate resume...",
    "job_description": "...target JD..."
  },
  "questions": {
    "role_category": {
      "type": "choice",
      "instructions": "Which role category best describes the target job?",
      "criteria": {
        "software_engineering": "Software engineering or application development",
        "network_engineering": "Networking, infrastructure, routing, switching or network operations",
        "cybersecurity": "SOC, security operations, security engineering, threat detection or cybersecurity",
        "cloud": "Cloud engineering, cloud infrastructure or cloud operations",
        "data": "Data engineering, analytics or data science",
        "devops": "DevOps, platform engineering, CI/CD or infrastructure automation",
        "other": "None of the above"
      }
    },

    "overall_relevance": {
      "type": "score",
      "instructions": "How strongly does the candidate's existing resume align with the target job?",
      "criteria": [
        "Very weak",
        "Weak",
        "Limited",
        "Moderate",
        "Good",
        "Strong",
        "Very strong"
      ]
    },

    "has_major_skill_gap": {
      "type": "noul",
      "instructions": "Does the candidate appear to have a major qualification or skill gap for this target role?"
    }
  }
}
```

Do not hard-code these exact questions as the final implementation. They are examples of the intended architecture.

The implementation should define a reusable question library.

---

# 9. Requirement-Level Analysis

The application should create a normalized list of JD requirements.

Example:

```json
[
  {
    "id": "req_001",
    "type": "skill",
    "requirement": "CCNA",
    "importance": "required"
  },
  {
    "id": "req_002",
    "type": "skill",
    "requirement": "Azure",
    "importance": "preferred"
  },
  {
    "id": "req_003",
    "type": "experience",
    "requirement": "2+ years networking experience",
    "importance": "required"
  }
]
```

For each requirement, Jev should determine a controlled state such as:

```text
SUPPORTED
PARTIALLY_SUPPORTED
NOT_SUPPORTED
UNCLEAR
```

This should NOT mean that "not supported" equals "candidate does not have the skill."

It means:

**The supplied resume does not provide sufficient evidence for the skill.**

This distinction is critical.

---

# 10. Skill Matching Engine

For every important JD requirement, ask Jev to classify the evidence in the candidate's resume.

Example:

```text
JD:
"Experience with Cisco routing and switching."

Resume:
"Configured VLANs, OSPF and DHCP on Cisco Packet Tracer labs."
```

Potential decision:

```json
{
  "requirement": "Cisco routing and switching",
  "status": "PARTIALLY_SUPPORTED"
}
```

The system can then instruct the LLM:

"Emphasize the candidate's documented Cisco routing, switching and OSPF experience."

It must NOT instruct the LLM:

"Add Cisco routing and switching experience."

---

# 11. Evidence-First Resume Generation

This is one of the most important features.

Every generated resume claim should originate from one of:

1. Candidate's original resume.
2. Candidate-provided additional information.
3. Explicitly selected user information.

The generation model must not manufacture evidence.

Create an internal representation such as:

```json
{
  "claim": "Configured OSPF routing in Cisco environments",
  "source": "resume",
  "source_section": "projects",
  "supported": true
}
```

The LLM can rewrite the claim.

It cannot invent the underlying experience.

---

# 12. Resume Optimization Plan

Before generation, Jev should produce a structured optimization plan.

Example:

```json
{
  "priority": [
    "Highlight Cisco networking experience",
    "Emphasize OSPF and VLAN experience",
    "Move networking certifications higher",
    "Reduce irrelevant frontend experience",
    "Use terminology appearing in the target JD where supported"
  ],
  "sections_to_modify": [
    "Professional Summary",
    "Skills",
    "Experience",
    "Projects",
    "Certifications"
  ],
  "sections_to_preserve": [
    "Education"
  ]
}
```

The LLM then receives this plan and performs the actual writing.

---

# 13. ATS Optimization

Do NOT market the feature as:

"Jev calculates the true ATS score."

Instead, build an internal **JD Alignment Score** based on measurable factors.

Potential components:

```text
Required-skill coverage
+
Preferred-skill coverage
+
Relevant terminology coverage
+
Experience alignment
+
Education/certification alignment
+
Section completeness
+
Evidence quality
-
Unsupported claims
-
Irrelevant content
```

Jev can provide individual structured judgments, while deterministic application code calculates the final product metric.

Example:

```text
JD Alignment: 82/100
Required Skills Supported: 8/10
Preferred Skills Supported: 4/7
Experience Alignment: Strong
Evidence Integrity: High
Major Gaps: 2
```

Clearly label this as the application's own alignment metric, not a universal ATS score.

---

# 14. Resume Generation Pipeline

The pipeline should be:

```text
INPUT
↓
Resume Parser
↓
JD Parser
↓
Requirement Extraction
↓
Jev Requirement Analysis
↓
Optimization Plan
↓
LLM Resume Generation
↓
Jev Validation
↓
Deterministic Validation
↓
If problems → regenerate
↓
Final Resume
```

---

# 15. Jev Validation Pass

After the LLM generates the resume, send the original resume, JD, and generated resume to a second Jev evaluation.

Questions should include:

### Claim integrity

"Does the generated resume contain material claims that are unsupported by the source resume or user-provided information?"

### JD alignment

"Does the generated resume meaningfully address the important requirements of the target JD?"

### Relevance

"Does the generated resume contain substantial irrelevant content?"

### Formatting strategy

"Does the content structure follow the application's ATS-safe formatting rules?"

### Optimization completeness

"Are the major identified optimization opportunities reflected in the generated resume?"

The application then uses thresholds.

Example:

```text
IF claim_integrity = FAIL
    → reject generation

IF JD_alignment < threshold
    → perform optimization pass

IF relevance < threshold
    → regenerate

IF Jev confidence is low
    → use fallback LLM validation / human-visible warning
```

Jev's confidence should be treated as a signal for whether the application should trust the decision, not as a guarantee of correctness.

---

# 16. Cover Letter Workflow

The cover letter should use the same architecture.

Pipeline:

```text
Resume
+
JD
↓
Jev
↓
Identify strongest relevant evidence
↓
Identify employer/JD priorities
↓
Determine cover-letter angle
↓
LLM
↓
Generate cover letter
↓
Jev validation
↓
Final cover letter
```

Jev should determine things such as:

```text
primary_candidate_strength
secondary_candidate_strength
most_relevant_experience
most_relevant_project
most_relevant_skill
experience_gap
tone_strategy
```

The LLM converts these decisions into natural language.

---

# 17. One-Click Cover Letter

The UI should have:

**Generate Cover Letter**

The system should automatically:

1. Read the target JD.
2. Read the optimized resume.
3. Use Jev to determine the strongest relevant evidence.
4. Generate the cover letter.
5. Validate the letter.
6. Return a downloadable/editable result.

The candidate should not have to manually provide another prompt.

---

# 18. Jev API Architecture

Never call Jev directly from the browser.

Architecture:

```text
Browser
   ↓
Your Backend/API
   ↓
Jev API
```

The Jev API key must remain server-side in an environment variable.

For JavaScript/TypeScript, the official SDK is available as:

```bash
npm install @typesafe-ai/sdk
```

Alternatively, the application can call the Jev HTTP API through server-side `fetch`.

Recommended environment variable:

```env
TYPESAFE_API_KEY=...
```

Never expose this value to:

- React components
- browser JavaScript
- NEXT_PUBLIC_* variables
- client-side API calls
- source control

---

# 19. Recommended Technical Architecture

If the existing project uses Next.js/TypeScript, retain that architecture.

```text
Frontend
Next.js + TypeScript + Tailwind
        │
        ▼
Application API
        │
        ├── Resume Parser
        ├── JD Parser
        ├── Requirement Extractor
        ├── Jev Decision Engine
        ├── LLM Generation Engine
        ├── Resume Validator
        └── PDF/DOCX Generator
                │
                ▼
             Database
```

Suggested modules:

```text
/lib
  /jev
    client.ts
    questions.ts
    resume-analysis.ts
    requirement-analysis.ts
    validation.ts
    cover-letter-analysis.ts

  /resume
    parser.ts
    normalizer.ts
    optimizer.ts
    validator.ts
    generator.ts

  /job
    parser.ts
    requirements.ts
    matcher.ts

  /cover-letter
    strategy.ts
    generator.ts
    validator.ts
```

---

# 20. Batch Jev Questions

Whenever possible, ask multiple independent questions in a single Jev request.

Instead of:

```text
Request 1 → skill match
Request 2 → role classification
Request 3 → relevance
Request 4 → experience alignment
Request 5 → qualification gap
```

prefer:

```text
One Jev request
    ├── role classification
    ├── relevance score
    ├── qualification gap
    ├── experience alignment
    ├── skill coverage
    └── optimization priorities
```

Jev explicitly supports multiple questions in one request. This should reduce latency and API usage.

---

# 21. Cost-Control Strategy

The application should be designed to remain usable with minimal Jev expenditure.

## Do

- Batch questions.
- Normalize and deduplicate JD requirements.
- Avoid sending the same context repeatedly.
- Analyze only meaningful requirements.
- Cache analysis for identical resume + JD combinations.
- Run validation only after generation.
- Store structured Jev results.

## Do not

- Send the entire resume repeatedly when only one section is required.
- Use Jev to generate prose.
- Run separate Jev requests for every UI component.
- Re-run analysis when the source documents have not changed.

Jev currently documents a 64k-token maximum request and 32k-token constraint involving state plus the longest question, so the implementation should normalize and chunk unusually large resumes/JDs rather than blindly sending everything.

---

# 22. Caching

Create a hash:

```text
hash(
    normalized_resume
    +
    normalized_job_description
    +
    analysis_version
)
```

Use this as the analysis cache key.

If:

```text
same resume
+
same JD
+
same Jev question version
```

then reuse the previous analysis.

If the question definitions change, increment:

```text
analysis_version
```

and invalidate the old decision cache.

---

# 23. Confidence-Gated Workflow

Do not treat every AI decision as equally reliable.

Example:

```text
HIGH CONFIDENCE
→ automatically use decision

MEDIUM CONFIDENCE
→ use decision but mark internally for validation

LOW CONFIDENCE
→ fallback to LLM/deterministic rules or ask user
```

For example:

```text
Jev:
"Candidate appears to satisfy Azure requirement."

Confidence:
0.94

→ use normally
```

Whereas:

```text
Jev:
"Candidate may satisfy Kubernetes requirement."

Confidence:
0.43

→ do not automatically add Kubernetes to the resume
→ preserve uncertainty
→ require evidence or user confirmation
```

The product should never convert uncertainty into fabricated qualifications.

---

# 24. User Experience

The candidate should NOT see complicated AI terminology.

Instead of:

"Jev Choice confidence = 0.93"

show:

**Resume analyzed**

```text
Strong matches
✓ Cisco
✓ OSPF
✓ Network troubleshooting

Needs attention
• Fortinet experience not found
• Cloud networking experience limited

Optimization opportunities
• Strengthen professional summary
• Reorder technical skills
• Highlight networking projects
```

Optional advanced view:

**AI Analysis**

```text
JD Alignment: 84%
Evidence Integrity: High
Required Skills: 8/10
Preferred Skills: 4/7
```

---

# 25. Candidate Control

The system must allow users to review important changes.

Before finalizing, optionally show:

```text
We found 7 areas to optimize.

✓ Emphasize Cisco experience
✓ Highlight OSPF project
✓ Reorder certifications
✓ Rewrite professional summary
✓ Reduce irrelevant experience
✓ Add supported JD terminology
✓ Improve achievement wording
```

The user can accept/reject individual modifications.

This makes the application an optimization assistant rather than an opaque AI rewriting machine.

---

# 26. Safety / Integrity Rules

The following rules are mandatory:

### Never fabricate qualifications

If the JD says:

```text
"5 years of AWS experience"
```

and the resume does not demonstrate this, the system must not create AWS experience.

### Never fabricate metrics

Do not transform:

```text
"Managed customer tickets"
```

into:

```text
"Reduced ticket resolution time by 37%"
```

unless the candidate supplied the metric.

### Never fabricate certifications

Do not add:

```text
AWS Certified Solutions Architect
```

unless supported by candidate data.

### Never fabricate employment

Do not add companies, titles or dates.

### Never convert absence of evidence into evidence of absence

"Not found in resume" ≠ "candidate does not have this skill."

---

# 27. Resume Templates

The Jev integration should remain independent from document rendering.

Architecture:

```text
Jev
 ↓
Optimization decisions
 ↓
LLM
 ↓
Structured Resume JSON
 ↓
Template Engine
 ↓
PDF/DOCX
```

The generator should ideally produce structured data:

```json
{
  "summary": "...",
  "experience": [],
  "skills": [],
  "education": [],
  "certifications": [],
  "projects": []
}
```

The template engine then renders it.

This allows future templates without changing the AI pipeline.

---

# 28. Resume Output Requirements

The final resume should be:

- ATS-friendly;
- text-based;
- machine-readable;
- cleanly structured;
- professionally formatted;
- free of unnecessary graphics;
- free of fabricated claims;
- tailored to the supplied JD;
- editable where possible;
- downloadable as PDF;
- optionally downloadable as DOCX.

---

# 29. Analytics

Track internally:

```text
resume_analysis_started
resume_analysis_completed
resume_generated
resume_regenerated
cover_letter_generated
validation_failed
validation_passed
user_accepted_optimization
user_rejected_optimization
```

Do NOT store sensitive resume content unnecessarily.

Store structured analytics rather than raw documents wherever possible.

---

# 30. MVP

The first Jev implementation should contain only:

### Feature 1

Resume + JD input.

### Feature 2

Jev role classification.

### Feature 3

Jev requirement matching.

### Feature 4

Jev resume alignment score.

### Feature 5

Jev optimization plan.

### Feature 6

Existing LLM resume generation.

### Feature 7

Jev post-generation validation.

### Feature 8

Existing one-click cover letter generation.

### Feature 9

Jev cover-letter strategy.

### Feature 10

Final resume and cover-letter download.

Do not build unnecessary agent functionality in V1.

---

# 31. V2

After the MVP works:

- Multiple resume versions.
- Job application tracker.
- Resume version comparison.
- Skill-gap dashboard.
- JD history.
- Application-specific resume library.
- LinkedIn profile optimization.
- Portfolio optimization.
- Interview preparation based on the same JD.
- Candidate-controlled evidence library.
- Resume performance analytics.

Jev can become the decision layer across the entire job-search workflow.

---

# 32. Example End-to-End Scenario

Candidate uploads:

```text
Resume:
Network support + Cisco labs + CCNA + Azure fundamentals
```

Target JD:

```text
Junior Network Engineer

Requirements:
Cisco
Routing
Switching
OSPF
BGP
Azure
Fortinet
2 years experience
```

Jev analyzes the evidence.

Potential structured result:

```text
Cisco → SUPPORTED
Routing → SUPPORTED
Switching → SUPPORTED
OSPF → SUPPORTED
BGP → UNCLEAR
Azure → PARTIALLY_SUPPORTED
Fortinet → NOT_SUPPORTED
2 years experience → NOT_SUPPORTED
```

The optimization engine then tells the LLM:

```text
Emphasize:
Cisco
Routing
Switching
OSPF
Azure

Do not claim:
BGP
Fortinet
2 years professional experience

Improve:
Professional summary
Skills ordering
Networking project descriptions
Certification visibility
```

The LLM generates the resume.

Jev then validates the generated version.

If the generated resume says:

```text
"Expert in Fortinet firewalls"
```

but there is no evidence for this:

```text
VALIDATION → FAIL
```

The application rejects that version and regenerates it.

This is the core value of the integration.

---

# 33. Definition of Done

The Jev integration is complete when:

- [ ] User can upload a resume.
- [ ] User can enter a target JD.
- [ ] Resume and JD are normalized.
- [ ] Jev analyzes the candidate/JD relationship.
- [ ] Requirements are classified.
- [ ] Optimization priorities are generated.
- [ ] Existing LLM generates the tailored resume.
- [ ] Jev validates the generated resume.
- [ ] Unsupported claims are detected.
- [ ] Invalid generations can automatically trigger regeneration.
- [ ] Cover-letter strategy is generated through Jev.
- [ ] LLM generates the final cover letter.
- [ ] Final documents can be downloaded.
- [ ] API keys remain server-side.
- [ ] Jev requests are batched where possible.
- [ ] Analysis is cached.
- [ ] Errors and rate limits are handled.
- [ ] The system does not fabricate candidate qualifications.
- [ ] The UI remains simple for job seekers.
- [ ] The application remains useful even if Jev is temporarily unavailable.

---

# 34. Fallback Architecture

Jev must never become a single point of failure.

If Jev is unavailable:

```text
Jev unavailable
       ↓
Deterministic rules
       +
Existing LLM
       ↓
Continue resume generation
```

The application should clearly mark that advanced decision validation was unavailable if that affects the result.

Do not allow a temporary Jev outage to destroy the existing product.

---

# 35. Final Product Positioning

The product should no longer be described simply as:

"AI Resume Builder."

Position it as:

**AI Resume Optimization Engine**

or:

**Intelligent Resume & Job Matching Platform**

The key technical differentiator is:

> A hybrid AI resume system where a generative model creates the candidate's documents while Jev provides the structured decision layer for job matching, evidence validation, optimization prioritization, and quality control.

This is the architectural improvement we are implementing.

---

# 36. Implementation Priority

Build in this exact order:

```text
PHASE 1
Jev API integration
↓
PHASE 2
Resume/JD normalization
↓
PHASE 3
Requirement classification
↓
PHASE 4
Resume optimization plan
↓
PHASE 5
Connect optimization plan to existing LLM
↓
PHASE 6
Post-generation Jev validation
↓
PHASE 7
Automatic regeneration when validation fails
↓
PHASE 8
Cover-letter strategy
↓
PHASE 9
Caching + cost optimization
↓
PHASE 10
UX polish + analytics
```

The existing resume generator should continue working throughout implementation.

Do not rewrite the entire application just to add Jev.

---

# 37. Core Architectural Principle

The final system should follow this rule:

**LLM = Generation**

**Jev = Judgment**

**Application Code = Control**

**Candidate = Final Authority**

That separation should be maintained throughout the codebase.

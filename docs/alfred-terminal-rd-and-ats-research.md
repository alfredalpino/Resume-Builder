# Alfred Terminal — R&D Program & ATS Research Dossier

**Version:** 1.0  
**Date:** 29 September 2026  
**Product:** Alfred Terminal (`alfredterminal.xyz`)  
**Current scope:** Tailored Resume + Cover Letter  
**Purpose:** Product R&D roadmap and deep research on Applicant Tracking Systems (ATS), resume parsing, matching, ranking, and ATS-resilient resume generation.

---

## Executive Summary

Alfred Terminal should evolve from a document generator into an **evidence-grounded application intelligence system**. The existing MVP is already clear: a candidate supplies a current resume and a target job description; Alfred tailors the resume and can produce a cover letter. The highest-value next step is to create a shared intelligence layer that understands the relationship between the candidate's verified experience and the target role before either document is written.

The strongest product direction is an architecture with four distinct responsibilities:

- **Evidence Engine:** what is actually true and supported by the candidate's source material.
- **Decision Layer:** what matters for this job, what is supported, what is unclear, and what should be emphasized.
- **Generative Layer:** how the verified facts should be written in a concise, role-relevant way.
- **Document Layer:** how the final resume/cover letter is rendered and exported.

Jev fits the **Decision Layer** particularly well because it produces structured decisions, classifications, scores, and probabilities rather than acting as a prose writer. The existing generative model should remain responsible for natural-language generation.

The second half of this dossier addresses ATS reality. An ATS is **not one universal scoring machine** and there is no technically honest way to promise a resume will pass every ATS “100% of the time.” Modern recruiting stacks are configurable systems of record and workflow, with parsing, structured application fields, search/filtering, skill matching, questionnaires, AI-assisted review, and human decision-making varying by vendor and employer. Official documentation from Workday, Greenhouse, Oracle, Lever, and SmartRecruiters demonstrates that behavior differs by configuration and implementation. [Sources listed in Appendix A.]

Therefore Alfred should not optimize for a mythical universal ATS score. It should optimize for **parseability, evidence integrity, requirement coverage, semantic relevance, structured completeness, and robustness across common ATS workflows**.

---

# Part I — Alfred Terminal R&D Program

## 1. Current Product State

### Current user journey

```text
Candidate
   |
   +--> Upload current resume
   |
   +--> Paste target job description
   |
   +--> Tailor resume
   |
   +--> Export PDF/DOCX
   |
   +--> Generate cover letter
```

This is a valid MVP. The weakness is not a missing pile of features; it is that the system currently has limited **application intelligence between input and generation**.

### Core current promise

> Tailor the application to the job without changing the truth behind the candidate's experience.

### R&D objective

Turn that promise into a measurable technical system rather than a marketing statement.

---

## 2. R&D Gap Map

| Gap | Current weakness | Target capability | Business value | Priority |
|---|---|---|---|---|
| Evidence grounding | Generated text can only be as trustworthy as the source prompt | Structured evidence graph with provenance | Trust + lower hallucination risk | P0 |
| Requirement understanding | JD is treated mainly as rewrite context | Normalized requirement taxonomy | Better relevance | P0 |
| Explainability | User sees result, not reasoning | Application Brief + requirement matrix | Confidence + transparency | P0 |
| Missing evidence | System can either omit or risk inventing | Ask-me-don't-invent flow | Better tailoring without fabrication | P0 |
| Validation | Generation may not be fully checked | Post-generation claim/evidence validator | Integrity + quality | P0 |
| ATS robustness | “ATS-friendly” is too broad | Parseability and compatibility test suite | Defensible product claim | P0 |
| Change visibility | User may not know why content changed | Before/After + rationale | User control | P1 |
| Candidate reuse | Re-uploading same career history is repetitive | Master Profile | Retention + lower friction | P1 |
| Application continuity | Resume and cover letter can be separate artifacts | Application Package | Better workflow | P1 |
| Personalization | Same resume facts are repeatedly rediscovered | Persistent evidence store | Speed + consistency | P1 |
| Telemetry | Limited product learning | Funnel/quality analytics | Faster iteration | P1 |
| Privacy | Resume data is sensitive | Minimize, encrypt, retention controls | Trust/compliance posture | P0 |

---

# 3. Feature R&D: Evidence Engine

## Problem

An LLM can rewrite facts, but a generic generation prompt does not provide a durable representation of what is actually supported by the candidate.

## Solution

Create a structured **Candidate Evidence Graph**.

```json
{
  "candidate": {
    "identity": {},
    "experience": [],
    "projects": [],
    "education": [],
    "skills": [],
    "certifications": [],
    "achievements": []
  },
  "evidence": []
}
```

Each evidence item should contain:

- normalized claim;
- original wording;
- source section;
- source document ID/version;
- confidence;
- date/context when available;
- whether it is explicit or inferred;
- whether the user explicitly confirmed it.

### Example

```json
{
  "claim": "Configured OSPF on Cisco equipment",
  "source": "resume",
  "source_section": "Projects",
  "evidence_level": "explicit",
  "user_confirmed": true
}
```

The generator may rewrite the wording. It may not manufacture the underlying claim.

### R&D question

Can Alfred detect unsupported claims in generated resumes with a lower false-negative rate than a simple prompt-based validator?

### Acceptance target

No high-severity unsupported claim should survive the validation pipeline without an explicit user override.

---

# 4. Feature R&D: Application Brief

Before generation, create an internal and user-visible compact brief.

Example:

```text
ALFRED / APPLICATION BRIEF

Target
Software Engineer — ExampleCo

ROLE ALIGNMENT
82%

STRONG MATCHES
React · TypeScript · REST APIs · AWS

GAPS / UNCERTAINTY
Kubernetes · Terraform

PRIORITIZE
Backend projects · cloud experience · API work

DE-EMPHASIZE
Unrelated experience

STRATEGY
Position the candidate as a frontend-heavy
full-stack engineer with cloud exposure.
```

This makes the product feel like an intelligence system rather than a text transformer.

---

# 5. Feature R&D: Requirement Matrix

Normalize every meaningful job requirement.

```json
{
  "requirement_id": "req_001",
  "text": "Experience with AWS",
  "type": "skill",
  "importance": "required",
  "evidence_status": "supported",
  "evidence": ["certification_04", "project_07"]
}
```

Use controlled statuses:

- `SUPPORTED`
- `PARTIALLY_SUPPORTED`
- `NOT_FOUND`
- `UNCLEAR`

Do not equate `NOT_FOUND` with “candidate definitely lacks the skill.” It only means the submitted evidence did not establish it.

---

# 6. Feature R&D: Ask Me, Don't Invent

This should become a signature trust feature.

Example:

> The job asks for CI/CD experience, but your resume does not provide enough evidence. Have you worked with CI/CD?

Actions:

`Yes` / `No`

If yes:

> Which tools have you used?

The candidate's answer becomes new evidence.

This converts ambiguity into verified information instead of hallucination.

---

# 7. Feature R&D: Before → After Intelligence

For meaningful changes, show:

**Original**

> Developed web applications using React.

**Alfred**

> Built web applications with React and TypeScript, implementing reusable components and API integrations.

**Why**

> TypeScript and API integration are relevant to the target role and are supported by your submitted experience.

This gives users control and makes tailoring defensible.

---

# 8. Feature R&D: Jev Decision Layer

Use Jev for structured decisions such as:

- role category;
- requirement support status;
- relevance score;
- missing-vs-unclear classification;
- section priority;
- validation flags;
- whether a clarification question should be asked;
- cover-letter strategy signals.

Keep the separation:

```text
Jev = judgment
LLM = language generation
Application code = orchestration and policy
Candidate = final authority
```

The application must not treat Jev output as infallible.

---

# 9. Feature R&D: Master Candidate Profile

After the candidate has completed a first application, Alfred should optionally retain a structured profile.

```text
MASTER PROFILE
├── Experience
├── Projects
├── Skills
├── Education
├── Certifications
├── Achievements
└── Confirmed evidence
```

Next application:

```text
Master Profile + New JD
        |
        v
Application Brief
        |
        v
Tailored Resume + Cover Letter
```

This can remove most repetitive input from subsequent applications.

---

# 10. Feature R&D: Application Package

Turn two outputs into one application object.

```text
APPLICATION

Software Engineer
ExampleCo

Resume                Ready
Cover Letter          Ready
Role Alignment        84%
Fact Integrity        Passed

[ Download Resume ]
[ Download Cover Letter ]
```

Future versions can store many applications without changing the core model.

---

# 11. Feature R&D: Cover Letter Intelligence

Cover letters should use the same evidence graph and requirement map as the resume.

```text
Resume + JD
    |
    v
Requirement Map
    |
    +--> Resume Strategy
    |
    +--> Cover Letter Strategy
```

This prevents the resume and cover letter from describing two different versions of the candidate.

---

# 12. Feature R&D: ATS Robustness Lab

This should be treated as an engineering product capability, not a marketing score.

For every generated file:

1. Parse the exported PDF/DOCX back into plain text.
2. Compare extracted text with the structured resume JSON.
3. Detect missing sections.
4. Detect broken reading order.
5. Detect missing characters.
6. Detect encoding problems.
7. Detect images where text is expected.
8. Detect tables/text boxes/columns when the chosen template declares them risky.
9. Compare the final extracted text against the pre-export text.
10. Run requirement coverage again.

Output:

```text
ATS ROBUSTNESS CHECK

Text extraction       PASS
Section detection     PASS
Contact extraction    PASS
Experience extraction PASS
Skills extraction     PASS
Reading order         PASS
Requirement coverage  84%
Unsupported claims    0
```

This is significantly more useful than simply printing “ATS 92.”

---

# 13. Product Roadmap

## Phase 0 — Reliability baseline

- Preserve current features.
- Add structured logging.
- Add export round-trip parsing.
- Add regression fixtures.
- Add privacy/retention rules.

## Phase 1 — Intelligence foundation (P0)

- Resume normalization.
- JD normalization.
- Requirement taxonomy.
- Evidence graph.
- Jev decision layer.
- Application Brief.
- Requirement Matrix.
- Claim validator.

## Phase 2 — User control (P0/P1)

- Ask Me, Don't Invent.
- Before/After explanation.
- Section-level tailoring controls.
- Fact-protection status.

## Phase 3 — ATS engineering (P0)

- PDF round-trip parser.
- DOCX round-trip parser.
- Format validator.
- Reading-order tests.
- Common parser fixture set.
- Vendor-differentiated compatibility profiles.

## Phase 4 — Retention (P1)

- Master Profile.
- Application Package.
- Version history.
- Reuse confirmed evidence.

## Phase 5 — Growth extensions (only after core workflow is excellent)

- Job/application tracker.
- Interview preparation.
- LinkedIn optimization.
- Portfolio review.
- Job matching.

---

# Part II — ATS Research Dossier

# 14. What Is an ATS?

An **Applicant Tracking System (ATS)** is software that helps organizations collect, store, organize, search, evaluate, and move job applications through recruiting workflows. Greenhouse describes an ATS as a system that collects applications and candidate information and keeps the hiring workflow in one place. Workday similarly describes ATS functionality as a workflow spanning job posting, application intake, resume parsing, candidate data, and matching. [Greenhouse; Workday sources in Appendix A.]

Important distinction:

> **ATS is a category, not one algorithm.**

There is no universal ATS parser, universal keyword database, or universal candidate score.

Different employers may use:

- Workday Recruiting;
- Greenhouse;
- Lever;
- Oracle Recruiting/Taleo;
- SmartRecruiters;
- other commercial or custom systems;
- integrations around those systems;
- employer-configured questionnaires, filters, rankings, and human review.

The same resume can therefore be parsed, displayed, searched, filtered, or scored differently across systems.

---

# 15. How a Company Career Page Connects to an ATS

A modern careers website is often a presentation layer over a recruiting system.

Typical flow:

```text
Company career page
        |
        v
Job listing / job detail page
        |
        v
Apply button
        |
        v
ATS application form
        |
        +--> Contact details
        +--> Resume/CV
        +--> Cover letter
        +--> Structured experience
        +--> Screening questions
        +--> Voluntary/compliance questions
        |
        v
Candidate record + application
        |
        v
Recruiter workflow
        |
        +--> Search/filter
        +--> Matching/ranking
        +--> Review
        +--> Interview
        +--> Reject / advance / hire
```

### Workday example

Workday documents external career sites with a job listing page, job details page, and application form. The application form can include contact information, experience, application questions, voluntary disclosures, terms, and final review. Workday also supports resume parsing to prepopulate candidate information. [Workday Career Sites; Workday Resume Parsing.]

### Greenhouse example

Greenhouse provides branded job boards/career-page integrations and stores job, candidate, application, resume, education, employment, and custom-field information in the recruiting system. [Greenhouse Candidate Experience; Greenhouse field documentation.]

### Lever example

Lever states that an application is created when a candidate applies to a job posting through a public or internal job site, and its application form can contain custom questions plus file uploads such as resumes and cover letters. [Lever Developer documentation.]

### SmartRecruiters example

SmartRecruiters exposes dedicated resume parsing endpoints and returns parsed candidate data; it explicitly documents failure modes such as an unparseable resume, including an image-based resume. [SmartRecruiters developer documentation.]

---

# 16. Reference ATS Architecture

The exact internal architecture of a commercial ATS is proprietary and varies by vendor. The following is an **engineering reference model**, synthesized from documented ATS capabilities and standard information-extraction architecture; it is not a claim about any single vendor's internal implementation.

```text
                 JOB REQUISITION
                       |
                       v
               Job Posting / Career Page
                       |
                       v
                  Application Form
                       |
                       v
                Candidate Submission
                       |
        +--------------+--------------+
        |                             |
        v                             v
   Resume file                  Structured fields
        |                             |
        v                             |
  File validation                     |
        |                             |
        v                             |
 Text extraction                      |
        |                             |
        v                             |
 Layout / section analysis            |
        |                             |
        v                             |
 NLP / NER / patterns                 |
        |                             |
        +--------------+--------------+
                       |
                       v
             Structured candidate profile
                       |
                       v
              Normalization / taxonomy
                       |
                       v
             Search / filtering / matching
                       |
                       v
              Candidate review workflow
                       |
              +--------+--------+
              |                 |
              v                 v
          AI signals         Human review
              |                 |
              +--------+--------+
                       v
                 Stage progression
```

---

# 17. Resume Parsing: What Actually Happens

Resume parsing is an information-extraction problem.

Official Workday documentation states that resume parsing populates fields from a resume and that results can vary with resume format and word order; Workday recommends resumes without images or image-based styles. Oracle documents extraction of candidate information, education, and work-experience fields and notes header/footer detection. SmartRecruiters documents an API that parses a resume and can return an unparsable-resume error, including for images. [Workday; Oracle; SmartRecruiters sources in Appendix A.]

A practical parser pipeline is:

### Stage 1 — File intake

Validate:

- MIME type;
- extension;
- file size;
- file integrity;
- malware/security policy;
- supported file class.

### Stage 2 — Binary/text extraction

Possible inputs include:

- PDF;
- DOCX;
- DOC/RTF/TXT depending on system;
- HTML or other configured formats.

A text-native PDF may be directly extractable. An image-only PDF may require OCR, and some systems may fail or behave differently when text is not machine-readable.

### Stage 3 — Layout reconstruction

The system may attempt to recover:

- reading order;
- paragraphs;
- lines;
- headings;
- lists;
- sections;
- header/footer text.

This is why layout can matter even when the visible resume looks excellent to a human.

### Stage 4 — Section segmentation

The parser identifies regions such as:

- Summary;
- Experience;
- Education;
- Skills;
- Certifications;
- Projects;
- Languages;
- links/contact information.

This can be implemented with rules, classifiers, sequence models, or LLM-assisted extraction.

### Stage 5 — Entity extraction

Extract entities such as:

```text
PERSON
EMAIL
PHONE
LOCATION
COMPANY
JOB_TITLE
DATE
DEGREE
INSTITUTION
SKILL
CERTIFICATION
URL
```

Research literature describes resume parsers using combinations of named-entity recognition, regex/pattern matching, OCR, and NLP models. [IEEE/ACL research sources in Appendix A.]

### Stage 6 — Normalization

Normalize variants.

Example:

```text
JavaScript
JS
ECMAScript
```

may be represented as related concepts depending on the system's ontology.

Likewise:

```text
Software Engineer
Software Developer
Application Engineer
```

may be related but should not automatically be treated as identical for every decision.

### Stage 7 — Candidate profile construction

The parser produces structured fields that recruiters can search/filter/review.

---

# 18. Resume Parsing Is Not the Same as Candidate Matching

This distinction is central.

**Parsing** answers:

> What does this document contain?

**Matching** answers:

> How relevant is this candidate's information to this job?

A parser can successfully extract “Python” while a matching system may decide that Python is only a preferred skill, or that the candidate lacks enough years of Python experience.

A candidate can therefore be:

```text
Successfully parsed
+
Poorly matched
```

or:

```text
Partially parsed
+
Potentially relevant
```

Alfred should keep those concepts separate.

---

# 19. Job Description Processing

ATS matching requires a representation of the job requisition.

A practical job model contains:

```json
{
  "title": "Software Engineer",
  "seniority": "mid",
  "required_skills": [],
  "preferred_skills": [],
  "experience_requirements": [],
  "education_requirements": [],
  "certifications": [],
  "responsibilities": [],
  "location": [],
  "employment_type": "full-time",
  "custom_questions": []
}
```

Employers can also attach structured fields and custom application questions. Greenhouse documents default and custom candidate/job/application fields; Workday documents job application templates, required/hidden sections, and job-specific application questions. [Greenhouse and Workday sources in Appendix A.]

---

# 20. Matching and Ranking

There is no universal formula.

Documented systems show multiple approaches.

Workday describes a machine-learning-based skills match similarity based on skills derived from the candidate's application/resume and the job requisition, with greater weight for required skills. Workday also documents candidate skills suggestions and configurable scoring/matching capabilities. Oracle documents AI matching ratings for education, experience, and skills. Greenhouse documents talent matching that compares candidates against user-defined job criteria and explicitly says the AI does not autonomously advance or reject candidates. [Workday; Oracle; Greenhouse sources in Appendix A.]

A generic reference model might be:

```text
Candidate representation
        |
        +--> exact skill signals
        +--> normalized skill signals
        +--> semantic similarity
        +--> experience evidence
        +--> education evidence
        +--> certification evidence
        +--> application answers
        +--> location/eligibility signals
        |
        v
Requirement-weighted scoring
        |
        v
Filtering / prioritization
        |
        v
Recruiter review
```

Possible technical methods include:

- lexical matching;
- TF-IDF/BM25-style search;
- ontologies/taxonomies;
- embeddings/vector similarity;
- classifiers;
- gradient-boosted or other ranking models;
- LLM-based evaluations;
- deterministic filters;
- combinations of these.

Academic work on resume-to-job matching has explored BERT sentence-pair classification, TF-IDF, NER, topic models, embeddings, and hybrid extraction pipelines. These studies illustrate possible architectures, not the proprietary algorithms of commercial ATS vendors.

---

# 21. Application Questions and Knockout Logic

Resume content is only part of the application.

Career pages can include:

- yes/no eligibility questions;
- work authorization;
- location/relocation;
- experience questions;
- certifications;
- custom text questions;
- education;
- demographic/EEO questions where configured;
- consent and terms.

Workday documents configured job application templates and questionnaires. Lever documents posting-specific application fields and custom questions. [Workday; Lever sources.]

Therefore a candidate can have an excellent resume match and still be screened out or routed differently based on **structured application answers**.

Alfred should never market a tailored resume as the only determinant of progression.

---

# 22. Recruiter Workflow After Submission

A realistic high-level funnel is:

```text
Application received
        |
        v
Resume/application parsed
        |
        v
Structured candidate record
        |
        +--> Search
        +--> Filters
        +--> Matching/ranking
        +--> Screening questions
        |
        v
Recruiter review
        |
        v
Interview process
        |
        +--> Structured interviews
        +--> Scorecards / feedback
        +--> Additional tests
        |
        v
Decision / disposition / hire
```

Greenhouse explicitly describes job setup, sourcing, resume review, interviews, scorecards, and human-led decision-making as interconnected parts of its platform. Workday and Oracle similarly document candidate/application records, ratings, and recruiting workflows. [Appendix A.]

---

# 23. Why “100% ATS Guaranteed” Is Not Technically Honest

There are at least six reasons.

### 1. There is no single ATS

Employers use different products and configurations.

### 2. Parser behavior differs

Workday explicitly says parsing results vary based on resume format and order of words. SmartRecruiters documents unparsable files, including images. [Workday; SmartRecruiters.]

### 3. Matching differs

Some systems emphasize skills; others combine skills, experience, education, semantic similarity, configured filters, questions, or recruiter search.

### 4. Employers configure their own requisitions

Greenhouse and Workday document custom fields, job-specific attributes, application forms, and configurable templates.

### 5. Human review remains part of many workflows

Greenhouse explicitly states its talent-matching/AI features are assistive and do not make autonomous hiring decisions. [Greenhouse.]

### 6. The resume is only one input

Application questions, work authorization, location, eligibility, assessments, referrals, sourcing channel, and other structured data may affect workflow.

Therefore Alfred should promise **robustness**, not certainty.

---

# 24. What “ATS-Friendly” Should Mean Inside Alfred

Define it precisely as a product property.

An ATS-friendly Alfred resume should aim to be:

### Machine-readable

Text should be extractable from the file.

### Structurally recognizable

Common resume sections should be clearly labeled.

### Reading-order stable

The extracted text should preserve logical sequence.

### Semantically relevant

Important, supported role requirements should be reflected where appropriate.

### Evidence-grounded

No fabricated claims.

### Compact

Content should be concise enough to preserve signal.

### Consistent

Job titles, dates, company names, skills, and certifications should not conflict across sections.

### Export-safe

The final PDF/DOCX should be re-parsed and checked after rendering.

---

# 25. Resume Structure Recommendation for Alfred

Default template should prioritize robust parsing.

Recommended order:

```text
NAME + CONTACT

PROFESSIONAL SUMMARY

SKILLS

EXPERIENCE

PROJECTS (when useful)

EDUCATION

CERTIFICATIONS
```

The exact order should be adaptive by role, but the system should preserve recognizable section boundaries.

### Formatting policy

Prefer:

- standard section headings;
- normal text;
- conventional dates;
- bullet lists;
- a single logical reading order;
- explicit skill names;
- clear employer/title/date grouping.

Avoid making the default template depend on:

- images containing important information;
- text embedded in graphics;
- decorative elements that carry semantic meaning;
- complex reading-order layouts;
- content that only exists visually but is absent from selectable text.

The point is not that every ATS rejects columns or tables. The point is that **unnecessarily complex layouts create more parsing variability** and therefore reduce robustness.

---

# 26. Keyword Strategy: Stop Thinking “Keyword Stuffing”

Alfred should use three layers of terminology.

## Layer 1 — Exact supported terminology

If the JD says:

> TypeScript

and the candidate demonstrably uses TypeScript, use “TypeScript” naturally.

## Layer 2 — Supported related terminology

If the candidate has evidence for:

> REST APIs

the resume can emphasize that where relevant.

## Layer 3 — Unsupported terminology

If the JD asks for:

> Kubernetes

and the candidate has no supporting evidence, do not add Kubernetes to the resume merely to improve matching.

This is where Alfred's Evidence Engine becomes essential.

---

# 27. Exact Match + Semantic Match

Alfred should combine multiple matching views.

```text
Exact terminology
        +
Normalized skill taxonomy
        +
Semantic similarity
        +
Evidence strength
        +
Requirement importance
```

Example:

JD:

> “Infrastructure as Code using Terraform.”

Candidate evidence:

> “Automated cloud infrastructure deployment with Terraform modules.”

This is a strong explicit match.

Another candidate might say:

> “Automated cloud infrastructure provisioning.”

with no Terraform evidence.

This may be semantically related but is **not enough to claim Terraform**.

That distinction must be preserved.

---

# 28. Experience Matching

Do not treat years of experience as a simple keyword.

Example requirement:

> 3+ years of Python experience.

The system should model:

```text
Technology: Python
Evidence sources: Experience A, Project B
Date coverage: 2022–2026
Professional vs project: mixed
Confidence: high
```

Then determine whether the evidence actually establishes the required duration.

If it cannot, classify as:

`UNCLEAR`

not automatically `PASS`.

---

# 29. Requirement Prioritization

Not every JD phrase is equally important.

Build a hierarchy:

```text
REQUIRED
PREFERRED
CORE RESPONSIBILITY
SECONDARY RESPONSIBILITY
CONTEXTUAL / DESCRIPTIVE
```

Where the JD is ambiguous, the system should preserve uncertainty rather than pretending to know the employer's exact weighting.

Workday documentation provides a concrete example of required skills receiving greater weight in its Candidate Skills Match calculation. Other vendors may weight signals differently.

---

# 30. Candidate Evidence vs JD Language

A dangerous failure mode is “keyword injection.”

Bad pipeline:

```text
JD contains Kubernetes
        |
        v
LLM adds Kubernetes
```

Alfred pipeline:

```text
JD contains Kubernetes
        |
        v
Find candidate evidence
        |
   +----+----+
   |         |
 found    not found
   |         |
   v         v
emphasize   flag gap
```

This should be a hard product rule.

---

# 31. Export and Re-Parse Loop

The final document itself must be tested.

```text
Structured Resume JSON
        |
        v
DOCX/PDF Renderer
        |
        v
Final File
        |
        v
Parser / Extractor
        |
        v
Extracted Text
        |
        v
Compare Against Source JSON
```

Check:

- missing name;
- missing email;
- missing phone;
- missing dates;
- missing skill text;
- missing headings;
- duplicated content;
- scrambled order;
- broken characters;
- image-only output.

This is one of the most valuable engineering features Alfred can build because it validates the **actual exported artifact**, not just the content before export.

---

# 32. ATS Compatibility Profiles

Instead of pretending to emulate every ATS, create profiles.

Example:

```text
PROFILE: CONSERVATIVE_TEXT_PARSER

- text-first PDF
- standard headings
- single logical reading order
- no semantic dependence on graphics
```

```text
PROFILE: MODERN_AI_RECRUITING

- structured sections
- normalized entities
- exact + semantic skill matching
- required/preferred distinction
- application-question awareness
```

Future profiles can model documented behaviors from major systems without claiming access to proprietary scoring algorithms.

---

# 33. ATS Robustness Score for Alfred

Do not call this:

> Guaranteed ATS Score

Call it something like:

> **ATS Robustness**

or

> **Application Compatibility**

Possible composition:

```text
25% Parseability
20% Structure
20% Requirement coverage
15% Evidence integrity
10% Terminology consistency
10% Export integrity
```

These weights are an **Alfred product metric**, not a statement about any commercial ATS algorithm.

Each component must be independently explainable.

Example:

```text
ATS ROBUSTNESS
88 / 100

Parseability            100
Structure                94
Requirement coverage    81
Evidence integrity      100
Terminology consistency  87
Export integrity        100
```

The user should be able to click each metric and see what caused it.

---

# 34. Automated Regression Corpus

Create an internal test set containing resumes with:

- one-column layout;
- two-column layout;
- dense technical resumes;
- older resumes;
- unusual headings;
- tables;
- icons;
- header/footer contact information;
- long URLs;
- multiple jobs at one company;
- freelance work;
- overlapping dates;
- projects with technologies;
- certifications;
- international education formats;
- image-only PDFs;
- OCR-heavy PDFs;
- multiple languages where supported.

For each fixture, store:

```text
input file
expected extracted text
expected structured fields
expected reading order
known parser risks
```

This becomes Alfred's parser laboratory.

---

# 35. Testing Strategy

## Unit tests

- requirement extraction;
- evidence matching;
- normalization;
- date parsing;
- section classification.

## Integration tests

- resume upload;
- JD ingestion;
- Jev decision call;
- LLM generation;
- export;
- reparse;
- validation.

## Golden-file tests

Compare generated resume JSON and exported text against known expectations.

## Adversarial tests

Try to force:

- hallucinated skills;
- invented employers;
- invented metrics;
- missing dates;
- duplicated skills;
- contradictory titles;
- broken PDFs;
- unusual Unicode;
- multi-column reading-order errors.

---

# 36. Metrics Alfred Should Track

## Product metrics

- resume generation completion rate;
- cover letter generation rate;
- download rate;
- regeneration rate;
- optimization acceptance rate;
- user rejection of proposed changes;
- time to completed application.

## Quality metrics

- unsupported-claim rate;
- claim-validation false-negative rate;
- parse round-trip success;
- requirement extraction accuracy;
- requirement coverage;
- document extraction loss;
- user-reported correction rate.

## Cost metrics

- Jev tokens/request;
- LLM tokens/request;
- average generation cost;
- validation cost;
- cache hit rate.

---

# 37. Privacy and Data Governance

Resumes are sensitive personal documents.

The system should implement:

- explicit retention policy;
- deletion controls;
- encrypted storage where applicable;
- encrypted transport;
- least-privilege API access;
- secret management;
- no unnecessary raw-document duplication;
- auditability of generated documents;
- user-visible control over saved profiles.

Where possible, persist structured evidence separately from raw documents and retain only what is necessary for the product workflow.

Workday's public recruiting documentation also demonstrates that recruiting systems have privacy-data retention and purge capabilities, which reinforces that retention is an operational requirement rather than an optional afterthought. [Workday Job Applications.]

---

# 38. Suggested Technical Data Model

```text
User
 ├── CandidateProfile
 │    ├── EvidenceItem[]
 │    ├── Skill[]
 │    ├── Experience[]
 │    ├── Education[]
 │    └── Certification[]
 │
 └── Application[]
      ├── JobDescription
      ├── Requirement[]
      ├── JevDecision[]
      ├── ResumeVersion[]
      ├── CoverLetterVersion[]
      └── ValidationReport
```

### EvidenceItem

```text
id
claim
sourceDocumentId
sourceSection
originalText
normalizedConcept
confidence
explicitOrInferred
userConfirmed
createdAt
```

### Requirement

```text
id
text
type
importance
normalizedConcept
evidenceStatus
evidenceIds[]
confidence
```

### JevDecision

```text
id
applicationId
questionId
inputHash
result
confidence
modelVersion
createdAt
```

### ValidationReport

```text
parseability
sectionIntegrity
claimIntegrity
requirementCoverage
exportIntegrity
issues[]
status
```

---

# 39. Recommended Generation Contract

Never send a vague prompt such as:

> “Make this resume ATS-friendly.”

Instead, the generation model should receive structured instructions:

```json
{
  "candidate_evidence": [],
  "job_requirements": [],
  "optimization_plan": [],
  "forbidden_claims": [],
  "allowed_new_evidence": [],
  "style_constraints": [],
  "output_schema": "resume_v1"
}
```

This creates deterministic boundaries around a generative model.

---

# 40. Recommended Validation Contract

After generation:

```json
{
  "generated_claims": [],
  "unsupported_claims": [],
  "requirements_addressed": [],
  "requirements_unaddressed": [],
  "structural_issues": [],
  "final_status": "PASS"
}
```

The application should reject or revise output when high-severity integrity issues are detected.

---

# 41. What Alfred Should Never Claim

Avoid:

- “100% ATS compatible.”
- “Guaranteed ATS pass.”
- “Guaranteed interview.”
- “Guaranteed job.”
- “Every ATS uses the same scoring algorithm.”
- “ATS only checks keywords.”
- “A certain keyword density guarantees ranking.”

Better:

> Built for machine-readable resume formats and structured job alignment.

> Optimized for common ATS parsing and matching patterns.

> Alfred validates the exported document rather than assuming the draft will parse correctly.

---

# 42. R&D Experiments Worth Running

## Experiment A — Parser robustness

Compare 5–10 resume layouts across multiple parsers/services and measure:

- field extraction accuracy;
- reading order;
- missing content;
- date extraction;
- skills extraction.

## Experiment B — Evidence-constrained generation

Compare generic LLM prompting vs structured evidence-constrained generation.

Primary metric:

> Unsupported claims per generated resume.

## Experiment C — Jev-assisted decisions

Compare generation with and without the Jev decision layer.

Measure:

- requirement coverage;
- user correction rate;
- hallucination rate;
- generation latency;
- cost.

## Experiment D — Round-trip export

Compare resume JSON to extracted PDF/DOCX text.

Measure:

- text loss;
- order loss;
- entity loss.

## Experiment E — User trust

Show users a normal AI resume vs an evidence-explained resume.

Measure:

- accepted changes;
- rejected changes;
- perceived trust;
- confidence before applying.

---

# 43. The “Revolutionary” Product Moat

The moat should NOT be:

> “We use AI to write resumes.”

That is easy to reproduce.

The deeper moat is:

```text
Candidate Evidence Graph
        +
Job Requirement Graph
        +
Decision Engine
        +
Evidence-grounded Generation
        +
Post-export Parser Validation
        +
Application History
```

This creates a system that understands:

**what the candidate has, what the job asks for, what is missing, what should be emphasized, how it was changed, and whether the final artifact survives its own parsing test.**

---

# 44. Target End-State Architecture

```text
                         ALFRED TERMINAL
                                |
                                v
                     Candidate Master Profile
                                |
              +-----------------+-----------------+
              |                                   |
              v                                   v
       Candidate Evidence                    Target JD
              |                                   |
              |                           Requirement Engine
              |                                   |
              +------------------+----------------+
                                 |
                                 v
                         Decision Layer (Jev)
                                 |
                  +--------------+--------------+
                  |              |              |
                  v              v              v
             Match Map     Gap Questions    Priorities
                  |              |              |
                  +--------------+--------------+
                                 |
                                 v
                       Application Strategy
                                 |
                  +--------------+--------------+
                  |                             |
                  v                             v
             Resume Writer              Cover Letter Writer
                  |                             |
                  +--------------+--------------+
                                 |
                                 v
                         Generated Documents
                                 |
                                 v
                         Export / Rendering
                                 |
                                 v
                       Round-trip Parser QA
                                 |
                                 v
                           Final Package
```

---

# 45. Recommended Build Order for Alfred Terminal

### P0 — Build now

1. Evidence Engine.
2. JD Requirement Engine.
3. Jev Decision Layer.
4. Application Brief.
5. Requirement Matrix.
6. Ask Me, Don't Invent.
7. Post-generation claim validation.
8. PDF/DOCX round-trip parser validation.
9. ATS Robustness metric.
10. Privacy and deletion controls.

### P1 — Build after P0 stabilizes

11. Before/After explanations.
12. Master Candidate Profile.
13. Application Package.
14. Version history.
15. Cover-letter strategy tied to shared evidence.

### P2 — Later

16. Application tracker.
17. Job matching.
18. Interview preparation.
19. LinkedIn/portfolio optimization.
20. Browser extension or job-page ingestion.

---

# 46. Final R&D Conclusions

### Product conclusion

Alfred Terminal should become an **application intelligence layer**, not just a resume formatter.

### Jev conclusion

Jev is best deployed as the system's structured decision engine. It should answer questions the rest of the application can consume, rather than being asked to write resumes.

### ATS conclusion

ATS behavior is heterogeneous. Official vendor documentation shows differences in parsing, structured candidate fields, job-specific configuration, matching, ratings, application questions, and human review. There is no single universal ATS score or 100% pass guarantee.

### Technical conclusion

The strongest ATS-oriented product is therefore not one that guesses a secret score. It is one that:

```text
1. Extracts the candidate reliably.
2. Extracts the job requirements reliably.
3. Preserves evidence provenance.
4. Matches requirements to evidence.
5. Uses exact + normalized + semantic signals.
6. Never invents missing qualifications.
7. Produces a simple machine-readable document.
8. Re-parses the final exported artifact.
9. Reports compatibility risks transparently.
```

### Product thesis

> **Alfred Terminal should optimize the application, not manipulate the candidate's history.**

That principle can become the foundation of the product's technical differentiation.

---

# Appendix A — Research Sources

The following sources were consulted for current vendor behavior, ATS workflows, and resume parsing/matching architecture. Accessed 29 September 2026.

- [Greenhouse — What is an Applicant Tracking System?](https://www.greenhouse.com/resources/glossary/what-is-an-applicant-tracking-system-ats)
- [Greenhouse — Candidate Experience](https://www.greenhouse.com/candidate-experience)
- [Greenhouse — AI Recruiting](https://www.greenhouse.com/ai-recruiting)
- [Greenhouse — AI interviewing guidelines / CV parsing and talent matching](https://www.greenhouse.com/uk/guidelines-for-using-ai-in-our-interviewing-process)
- [Greenhouse Support — System default fields vs. custom fields](https://support.greenhouse.io/hc/en-us/articles/360001421452-System-default-fields-vs-custom-fields)
- [Workday — Applicant Tracking System](https://www.workday.com/en-us/topics/hr/applicant-tracking-system.html)
- [Workday — Concept: Resume Parsing](https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/set-up-prospects-and-candidates/hdc1552497830785.html)
- [Workday — Prospects and Candidates](https://doc.workday.com/workday-education/en-us/course-manuals/recruiting-for-administrators/prospects-and-candidates.html)
- [Workday — Candidate Skills Match](https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/candidates/candidate-skills-match/bmj1604095304483.html)
- [Workday — Career Sites](https://doc.workday.com/workday-education/en-us/course-manuals/recruiting-for-administrators/career-sites.html)
- [Workday — Job Applications](https://doc.workday.com/admin-guide/en-us/human-capital-management/recruiting/job-applications/kro1504116876180.html)
- [Oracle — Candidate Management / Resume Parsing](https://docs.oracle.com/en/cloud/saas/talent-acquisition/17.4/otrec/candidate-management.html)
- [Oracle — Job Application AI Rating](https://docs.oracle.com/en/cloud/saas/readiness/hcm/25c/recr-25c/25C-recruiting-wn-f38352.htm)
- [Oracle — Candidate Applications AI Matching Ratings](https://docs.oracle.com/en/cloud/saas/talent-management/farqa/evaluate-candidate-applications-using-ai-matching-ratings.html)
- [Oracle — Career Sites](https://doc.workday.com/workday-education/en-us/course-manuals/recruiting-for-administrators/career-sites.html)
- [Lever Developer — Applications and Apply to a Posting](https://hire.lever.co/developer/documentation)
- [Lever — Application Sources](https://help.lever.co/s/article/Understanding-Candidate-Application-Sources-in-Lever-and-Job-Board-Integrations-2)
- [SmartRecruiters Developer — Parse a Resume](https://developers.smartrecruiters.com/reference/candidatesresumeparse)
- [SmartRecruiters — Resume Parsing](https://www.smartrecruiters.com/resources/glossary/resume-parsing/)
- [IEEE — Automated Resume Parsing: A Natural Language Processing Approach](https://ieeexplore.ieee.org/abstract/document/10334236)
- [IEEE — Resume Parsing and Skill Extraction using Custom Pattern Matching and Gemini API](https://ieeexplore.ieee.org/document/10775064/)
- [ACL — Rethinking Skill Extraction in the Job Market Domain using LLMs](https://aclanthology.org/2024.nlp4hr-1.3/)
- [ACL/ArXiv — Smart-Hiring: Explainable end-to-end CV extraction and job matching](https://arxiv.org/abs/2511.02537)
- [ArXiv — End-to-End Resume Parsing and Finding Candidates for a Job Description using BERT](https://arxiv.org/abs/1910.03089)


# Appendix B — Important Caveat on ATS Research

Commercial ATS vendors do not publish complete proprietary ranking and scoring logic. Accordingly, this dossier distinguishes between:

1. **Documented vendor behavior** — cited directly to vendor documentation.
2. **Engineering reference architecture** — a reasoned model synthesized from documented capabilities and established NLP/document-processing patterns.
3. **Product design recommendations** — proposed specifically for Alfred Terminal.

Where a vendor's exact algorithm is unavailable, Alfred should not present a reverse-engineered guess as fact.

# Appendix C — One-Sentence Product Positioning

> **Alfred Terminal understands the job, understands the candidate's verified experience, identifies the gap between them, and builds a relevant application without inventing the career.**

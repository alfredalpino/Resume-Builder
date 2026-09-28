# Alfred Terminal

> Your career, intelligently optimized.

AI resume tailor + cover letter assistant. **Tailored to the job. True to you.**

Domain target: `alfredterminal.xyz`

## How it works

1. Import PDF / DOCX / TXT / MD
2. Paste a job description
3. Alfred builds an optimization plan (deterministic; Jev when `TYPESAFE_API_KEY` is set)
4. Writer: free deterministic polish, or Pro Claude when `ANTHROPIC_API_KEY` + Pro entitlement
5. Validate (capitalization, no invented tech) → PDF / DOCX
6. One-click cover letter (strategy → prose)

## Local setup

```bash
cd Resume-Builder
cp .env.example .env.local
npm install
npm run dev
```

See `.env.example` for Auth, Anthropic, TypeSafe (Jev), and Razorpay stubs.

## Quality check

```bash
npx tsx scripts/golden-anas.ts
```

## Pricing (stubs until Razorpay is live)

- Free: Subtle / Medium
- Pro: ₹50/mo — Hard + Claude when configured
- Tips + public opt-in leaderboard at `/pricing`

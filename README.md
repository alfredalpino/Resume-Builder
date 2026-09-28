# Resume-Builder

ATS-friendly resume tailor with **Google Sign-In**, locked **Smart Thinking** (no LLM API keys), and dual **PDF + DOCX** export. Session-only.

## How it works

1. Import PDF / DOCX / TXT / MD (or paste text)
2. Paste a job description
3. **Smart Thinking** analyzes the JD and ranks your existing content
4. Download ATS-friendly PDF + DOCX with clickable links

### NLP stack (no Gemini)

| Library | Role |
|---------|------|
| `compromise` | Nouns, topics, organizations |
| custom TF-IDF | Cosine similarity (no `natural` — Vercel-safe) |
| `keyword-extractor` | Keyword candidates |
| `stopword` | Stopword filtering |
| `mammoth` / `unpdf` | DOCX / PDF text + links |
| `docx` / `@react-pdf/renderer` | Exports |

Smart Thinking never invents employers, degrees, or metrics. Gaps are reported honestly.

## Local setup

```bash
cd Resume-Builder
cp .env.example .env.local
npm install
npm run dev
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_URL` | App URL |

No AI provider keys.

## Deploy

Push to GitHub → Vercel project with the Auth env vars above.

# Resume-Builder

ATS-friendly resume tailor with **Google Sign-In**, **Local ATS (no API key)**, optional Gemini BYOK, and dual **PDF + DOCX** export. Session-only: nothing is persisted server-side.

## Features

- Import PDF / DOCX / TXT / MD (or paste text)
- **Local ATS** (default): JD keyword weave + reordering from your existing facts — no Gemini quota
- Optional Gemini mode with model picker + automatic fallback to Local ATS
- Preserve clickable hyperlinks in PDF and DOCX
- ATS match score with keyword hits/gaps
- Inline edit + structured JSON editor

## Stack

Next.js (App Router) · Auth.js (Google) · Gemini BYOK · Zod · mammoth · unpdf · `@react-pdf/renderer` · `docx` · Vercel

## Local setup

```bash
cd Resume-Builder
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Random secret (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_URL` | App URL (`http://localhost:3000` locally) |

No server-side Gemini key. Users paste their own key in the app (sent as `x-gemini-api-key`).

### Google OAuth

1. Create credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Authorized redirect URI: `{AUTH_URL}/api/auth/callback/google`
3. For production, add the Vercel URL as well

## Deploy on Vercel

1. Push this repo to GitHub (`alfredalpino`)
2. Import the project in Vercel
3. Set the env vars above (`AUTH_URL` = production URL)
4. Deploy

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint

## Privacy

- Gemini API key: browser session + request header only
- Resume/JD: processed in memory for the request; not stored
- Auth: JWT session via Auth.js

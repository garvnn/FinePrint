# FinePrint: Know Before You Sign

FinePrint is a privacy-first lease investigator for **Massachusetts residential leases**. Open a lease PDF and FinePrint:

1. **Parses it in your browser** with PDF.js. The file is never uploaded.
2. **Extracts financial terms** (rent, deposit, first/last month, fees, late fees, early-termination charges) with a deterministic rule engine, keeping the page and sentence each one came from.
3. **Calculates your exposure**: monthly and annual rent, cash due at signing, refundable versus non-refundable amounts, recurring fees, conditional penalties, and unknowns. Every formula is shown.
4. **Flags provisions worth questioning**: a deposit above one month's rent, extra move-in fees, late fees before 30 days, broad repair duties, shared utility billing, automatic renewal, liability waivers.
5. **Researches Massachusetts law with Tavily**. Only a generic topic ID such as `ma-security-deposit-limits` leaves the browser. Retrieved sources are checked for the language each finding relies on, which can confirm the finding or downgrade it.
6. **Produces a "Before You Sign" report** and an editable message to the landlord.

FinePrint gives general information, not legal advice. A flagged clause is not automatically illegal.

> Built for HACK1984 (Privacy-First, Surge/Tavily, and Most Startup-able tracks). See [DEMO.md](DEMO.md) for the judge walkthrough.

---

## Quick start

```bash
npm install          # also copies PDF.js worker/fonts into public/pdfjs
cp .env.example .env.local   # optional: add TAVILY_API_KEY for live research
npm run dev          # http://localhost:3000
```

Try it without a lease:

- `http://localhost:3000/analyze?sample=sample-a`: problematic sample lease (live research, with a labeled fallback if there's no key)
- `http://localhost:3000/analyze?sample=sample-a&research=bundled`: demo mode. No research requests; bundled statute excerpts, labeled as such
- `http://localhost:3000/analyze?sample=sample-b`: cleaner sample lease
- `http://localhost:3000/analyze?sample=sample-a&fixture=1&research=bundled`: fixture mode. Full UI from text fixtures, with no PDF and no network

Requires Node.js 22.13+ (PDF.js 6 requirement).

## Environment variables

| Variable | Required | Where | Purpose |
| --- | --- | --- | --- |
| `TAVILY_API_KEY` | No | Server only | Enables live legal research. Without it the app works, says live verification is unavailable, and shows bundled statute excerpts labeled "Bundled reference, not live". |

No variable is exposed to the browser (nothing is prefixed `NEXT_PUBLIC_`).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript) |
| `npm test` | Vitest unit tests (88 tests) |
| `npm run test:e2e` | Playwright smoke tests against the production build (run `npm run build` first; needs `npx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome) |
| `npm run samples` | Regenerate the fictional sample PDFs and edge-case test PDFs |
| `npm run check` | typecheck + lint + unit tests + build |

## Architecture (summary)

```
Browser (all document processing)                     Server (one endpoint)
──────────────────────────────────                    ──────────────────────
PDF.js (same-origin worker) → LeasePage[]              POST /api/research
  → segment → clauses (page offsets)                   { topicId, jurisdiction }  ← strict allowlist
  → extract → financial terms + provenance               → builds generic query itself
  → costs   → FinancialSummary (pure)                    → Tavily (official MA domains first)
  → rules   → findings (pending legal check)             → ranks, extracts excerpts, checks phrases
  → research client ── {topicId:"ma-…",jurisdiction:"MA"} ──►
  ← sources ◄──────────────────────────────────────────── { sources[], status, retrievedAt }
  → verify  → findings corroborated / downgraded
  → UI (dashboard, PDF highlight, report, audit)
```

Details: [ARCHITECTURE.md](ARCHITECTURE.md). Design system and swapping the UI: [DESIGN.md](DESIGN.md).

```
src/
  app/                 routes: / (landing), /analyze (app), /api/research (only server route)
  components/          UI only: ui/ (shadcn), landing/, upload/, lease/, findings/, financial/,
                       privacy/, report/, analyze/, layout/
  hooks/               use-lease-session (controller), use-audit
  lib/
    pdf/               PDF.js loading + pure text-layout builder
    analysis/          money parsing, segmentation, extraction, rules, research verification
    costs/             pure financial calculator
    research/          topic allowlist, request schema, browser client, bundled references,
                       server/ (Tavily client, rate limit, cache)
    privacy/           audit log + pre-send guard
    report/            report model + landlord letter
    fixtures/          fictional sample leases (source for PDFs and fixture mode)
  styles/theme.css     all design tokens
  types/lease.ts       domain model
tests/unit, tests/e2e, tests/fixtures
scripts/               PDF.js asset copy, sample PDF generator
```

## Privacy design

- **No upload path exists.** The only server route is `/api/research`, and its schema accepts exactly `{ topicId, jurisdiction }`. Extra fields, unknown topics, other jurisdictions, non-JSON and bodies over 256 bytes are rejected. Tests cover all of these.
- **The browser enforces it too.** A `Content-Security-Policy` with `connect-src 'self'` means the page cannot send requests to any third-party origin.
- **Pre-send guard.** Every research request passes a client-side check, and each request is written to the in-app **Privacy Audit** with its exact body.
- **Observed network activity.** The Privacy tab also lists every request the page made, from the browser's Resource Timing API.
- **No analytics or third-party scripts.** Fonts are self-hosted by `next/font`, and PDF.js assets are served from the app's own origin.
- **No persistence.** Nothing goes to cookies, localStorage, or a database. Closing the tab discards everything.
- **Server logs** record only `topic=<id> status=<status> sources=<n>`.

Limits are stated in the app and in [ARCHITECTURE.md](ARCHITECTURE.md#privacy-guarantees-and-limitations).

## Deploying to Vercel

1. Push this repository to GitHub (already at `github.com/garvnn/FinePrint`).
2. In Vercel: **Add New → Project → Import** the repo. The framework preset is detected as Next.js. Keep the default build command (`npm run build`) and output settings. `postinstall`/`prebuild` copy the PDF.js assets automatically.
3. Under **Settings → Environment Variables**, add `TAVILY_API_KEY` for Production (and Preview if wanted).
4. Deploy. Open `/analyze?sample=sample-a`; the banner should say sources were retrieved by live search.

Or with the CLI:

```bash
npm i -g vercel
vercel link
vercel env add TAVILY_API_KEY production
vercel --prod
```

Node.js 22.x or newer must be selected in Vercel project settings (the `engines` field requests ≥ 22.13).

## Known limitations

- **Rule engine, not AI.** FinePrint recognizes common phrasings of eight clause categories. Unusual wording can be missed. Unrecognized provisions are not interpreted, and the app says so.
- **Text-based PDFs only.** Scanned leases are detected and rejected; there is no OCR, because OCR would mean uploading or shipping a large model.
- **Massachusetts only, and law changes.** The bundled excerpts were captured from malegislature.gov on 2026-11-07. Live research is preferred.
- **Corroboration is phrase matching.** A finding counts as "supported" when an official source contains the phrases the rule depends on. That shows the source discusses the rule. It does not prove the clause is unlawful.
- **No bundled reference for automatic renewal.** That finding needs live research and otherwise shows "verification unavailable".
- **Highlighting** covers whole PDF text lines that contain the cited sentence. It is precise for typical text PDFs; when positions can't be found, the app says so instead of guessing.
- **Rate limiting and caching** are per server instance (in memory), so they are best-effort on serverless.
- Pricing and market-demand statements are hypotheses, not validated facts.

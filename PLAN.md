# FinePrint Implementation Plan and Status

_Last updated: 2026-11-07_

## P0: Must work

- [x] Next.js 16 App Router + TypeScript (strict) + Tailwind v4 + shadcn/ui (Radix) + Lucide
- [x] PDF upload (drag and drop + picker), validation (type, header, empty, 15 MB, 60 pages), in-browser PDF.js parsing, page text mapping with positioned spans
- [x] Scanned/empty PDF detection with a clear message
- [x] Two fictional sample leases rendered to real PDFs (`npm run samples`), plus edge-case PDFs for tests
- [x] Clause segmentation (sentences, headings, exact page offsets)
- [x] Financial term extraction: rent, total rent, first/last month, deposit (absolute and months-of-rent), one-time and recurring fees, late fees (grace days, %), early termination (absolute and months-of-rent, "in addition to"/"in lieu of"), lease term
- [x] Deterministic financial calculator with formulas, buckets (rent / one-time / refundable / conditional / unknown)
- [x] Findings dashboard: summary strip, Overview / Findings / Costs / Privacy / Report tabs, priority and category filters
- [x] Source-page evidence on every finding, with excerpts and amounts marked
- [x] Privacy-safe Tavily integration: allowlisted topics, strict schema, server-built queries, official-domain-first search, ranking, excerpts, timeout, rate limit, cache
- [x] Production build passes

## P1: Judging improvements

- [x] PDF highlighting: canvas render plus overlay boxes on the PDF.js text spans of the cited clause; auto page jump and scroll; honest message when positions are unavailable
- [x] Privacy Audit backed by real events (local steps, exact research payloads, guard result, response status) plus Resource Timing observations
- [x] CSP `connect-src 'self'` and security headers
- [x] Research changes findings (corroborated / not corroborated → downgraded / unavailable)
- [x] Bundled reference fallback (verbatim M.G.L. c. 186 excerpts, captured 2026-11-07), always labeled
- [x] Landlord questions + editable inquiry draft (copy only, never sent)
- [x] Print-friendly "Before You Sign" report
- [x] Responsive layout (verified at 375 px: no horizontal overflow) with a sticky PDF viewer on desktop
- [x] User correction of extracted values (rent, deposit, last month, term), which recalculates everything

## Rules implemented

Deposit > one month's rent · last month's rent > rent · upfront fees beyond first/last/deposit/lock-key · lock/key charge · late fee < 30 days / ≥ 30 days / unclear · early-termination fee (+ release language) · no early-termination option · broad repair duties (excludes tenant-caused-damage-only) · tenant pays water/sewer · shared utility allocation · tenant-paid utilities · automatic renewal + notice days · notice period · liability waiver / hold harmless · one-sided attorney's fees · joint and several liability · multiple rent amounts · total-rent mismatch · ambiguous fees · recurring fees · missing rent.

## Testing

- [x] 88 Vitest unit tests: money parsing, segmentation, extraction (rent, deposit, multiple values, missing amounts, ambiguous fees, relative amounts), costs (upfront, annual, refundable vs non-refundable, termination, overrides), research API (rejects lease text, unknown topics, extra fields, oversize, content type; unconfigured, timeout, no results, HTTP error, network failure, ranking, contradictory sources), privacy (guard, audit, architecture invariants), verification, both sample PDFs end to end, PDF edge cases, report/letter
- [x] 9 Playwright smoke tests against the production build: landing, demo mode, live-mode fallback with payload inspection, upload sends nothing, invalid/scanned errors, corrections, report, mobile overflow, API rejection
- [x] `tsc --noEmit`, ESLint, `next build` all clean

## Deferred (P2 / future)

- [ ] Lease version comparison (diff two leases)
- [ ] More clause categories: pets, subletting, entry/access notice, rent increases, parking, renter's insurance requirements
- [ ] Bundled reference for automatic renewal (needs a verified official source)
- [ ] Optional OCR for scanned PDFs (would need an in-browser model to keep the privacy guarantee)
- [ ] Persistent rate limiting / cache (e.g. Vercel KV) for multi-instance deployments
- [ ] Additional jurisdictions
- [ ] Dark mode toggle (tokens are ready)

## Known issues

- Rate limit and research cache are per server instance (best-effort on serverless).
- Highlighting covers whole text lines containing the cited sentence, not individual words.
- Corroboration is phrase matching against source text. It indicates relevance, not a legal conclusion.
- The live Tavily path has been verified against Tavily's documented API shape and with mocked responses in tests. It has not run against the real API in this environment because no key was available.
- In `next dev` (React Strict Mode) the audit log can show a duplicated research request because effects run twice; production builds do not.

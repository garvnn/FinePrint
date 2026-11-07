# FinePrint Architecture

## Data flow

```
┌──────────────────────────── Browser tab (trusted with the lease) ────────────────────────────┐
│                                                                                               │
│  File (File API) ──► validatePdfFile (type, header, ≤15 MB)                                    │
│        │                                                                                      │
│        ▼                                                                                      │
│  PDF.js worker (/pdfjs/pdf.worker.min.mjs, same origin)                                        │
│        │ text items + positions                                                               │
│        ▼                                                                                      │
│  lib/pdf/layout.buildPageFromItems ──► LeasePage { text, spans[] (offset ↔ bbox) }            │
│        │                                                                                      │
│        ▼                                                                                      │
│  lib/analysis/segment ──► LeaseClause[] (sentence, page, start/end offsets, heading)           │
│        ▼                                                                                      │
│  lib/analysis/extract ──► ExtractedFinancialTerm[] (amount, kind, refundable, provenance)      │
│        ▼                                                                                      │
│  lib/costs/summary    ──► FinancialSummary (pure, formulas, unknowns)                          │
│        ▼                                                                                      │
│  lib/analysis/rules   ──► LeaseFinding[] (verification: pending, researchTopicIds)             │
│        │                                                                                      │
│        ├─► lib/research/client.requestResearch(topicId) ──┐                                   │
│        │      privacy/guard.checkOutgoingPayload           │  {"topicId":"ma-…","jurisdiction":"MA"}
│        │      privacy/audit.recordAudit (exact body)       │                                   │
│        ▼                                                   │                                   │
│  lib/analysis/verify.applyResearch ◄── ResearchResponse ◄──┼───────────────┐                   │
│        ▼                                                   │               │                   │
│  UI: dashboard · PDF highlight · costs · audit · report    │               │                   │
└────────────────────────────────────────────────────────────┼───────────────┼───────────────────┘
                                         CSP connect-src 'self'              │
┌──────────────────── FinePrint server (never sees the lease) ┼──────────────┼───────────────────┐
│  app/api/research/route.ts                                  ▼              │                   │
│    size check (≤256 B) → rate limit → parseResearchRequest (zod .strict()) │                   │
│    → TopicCache (1 h, generic results only)                                │                   │
│    → lib/research/server/tavily.researchTopic(topicId)                     │                   │
│        query = RESEARCH_TOPICS[topicId].query  (server-built)              │                   │
│        search official domains (malegislature.gov, mass.gov) → widen if empty                 │
│        normalize, rank (official > phrase match > score), extract excerpt, match phrases      │
│    → logs only: topic, status, source count ────────────────────────────────┘                  │
└─────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                              ▼
                                   Tavily Search API (third party)
```

## Trust boundaries

| Boundary | What crosses it | What cannot |
| --- | --- | --- |
| Disk → browser tab | The PDF bytes (via the File API) | n/a |
| Browser → FinePrint server | `{ topicId, jurisdiction }` (≤ 256 bytes) | Lease text, excerpts, names, addresses, the PDF. The schema has no field for any of them. |
| Server → Tavily | A query string defined in `src/lib/research/topics.ts`, plus fixed search options | Anything from the request beyond the topic ID |
| Tavily → server → browser | Public legal source titles, URLs, excerpts | n/a |

Sample PDFs are downloaded **from** the FinePrint origin (`/samples/*.pdf`). That is public demo content, not user data, and the audit log records it as such.

## API request schema

`POST /api/research`

```jsonc
// Request: Content-Type: application/json, body ≤ 256 bytes
{
  "topicId": "ma-security-deposit-limits",   // enum, see below
  "jurisdiction": "MA"                         // enum: "MA"
}
// Any other property → 400. Unknown topicId → 400. Wrong content type → 415. Too large → 413.
// More than 40 requests/minute from one client (per instance) → 429.
```

Allowed `topicId` values (`src/lib/research/topics.ts`):

| topicId | Used by findings |
| --- | --- |
| `ma-security-deposit-limits` | Deposit exceeds one month's rent |
| `ma-upfront-charges` | Extra upfront fees, last month's rent above rent, lock/key charge |
| `ma-late-fees` | Late fee before 30 days |
| `ma-repair-obligations` | Repairs shifted to tenant |
| `ma-utilities-billing` | Tenant pays water/sewer; shared utility allocation |
| `ma-termination-notice` | (reserved) |
| `ma-lease-renewal` | Automatic renewal |
| `ma-landlord-liability-waiver` | Liability waiver / hold harmless |
| `ma-attorney-fees` | One-sided attorney fees |

```jsonc
// Response 200 (all outcomes, including failures, are 200 with a status)
{
  "topicId": "ma-security-deposit-limits",
  "jurisdiction": "MA",
  "status": "ok" | "no_results" | "unconfigured" | "timeout" | "error",
  "provider": "tavily",
  "query": "Massachusetts General Laws chapter 186 section 15B …",  // exact query sent, or null
  "sources": [{
    "title": "…", "url": "https://malegislature.gov/…", "excerpt": "…",
    "retrievedAt": "2026-11-07T17:02:11.000Z", "topicId": "…",
    "sourceType": "statute" | "regulation" | "government_guidance" | "other",
    "isOfficial": true, "origin": "live",
    "matchedPhrases": ["security deposit", "first month's rent"], "corroborates": true
  }],
  "retrievedAt": "…", "cached": false, "message": "…"
}
```

## Research → findings (keeping retrieval separate from conclusions)

1. **Rules** produce findings from lease facts alone, for example "deposit $2,700 > rent $1,800, excess $900". Each finding names the topic(s) it depends on and starts with `verification.status = "pending"`.
2. **Retrieval** returns sources. Proposed bills (`malegislature.gov/Bills/…`) and search-result pages are dropped, and case-variant duplicate URLs are merged. Ranking does not trust result order: official domains first (statutes > regulations > guidance), then phrase-match strength, then Tavily's score.
3. **Verification** (`lib/analysis/verify.ts`) is deterministic. Each topic defines corroboration phrase groups, for example *security deposit* AND *first month's rent*.
   - At least one official source matches every group → `corroborated`; priority is kept and the matching source is cited.
   - Sources exist but none official matches → `not_corroborated`; priority drops one level and the finding is relabeled "Needs review".
   - No sources at all → `unavailable`, with the reason (timeout, unconfigured, …).
4. A non-official source can never corroborate on its own. When sources conflict, the official one that matches wins and all considered sources are listed.

If live research is unavailable, the client applies **bundled references** (`lib/research/bundled.ts`): verbatim excerpts of M.G.L. c. 186 captured from malegislature.gov, marked `origin: "bundled"` and labeled "Bundled reference, not live" everywhere.

## Privacy guarantees and limitations

**Guaranteed by construction (and tested):**

- The PDF is parsed in the browser; there is no upload endpoint (`tests/unit/privacy.test.ts` asserts the only route handler is `api/research`).
- The research endpoint rejects raw lease text, unknown topics and unexpected fields (`tests/unit/research-api.test.ts`, `tests/e2e/smoke.spec.ts`).
- Uploading a PDF triggers no cross-origin request and no request body containing PDF data (`tests/e2e/smoke.spec.ts`).
- CSP `connect-src 'self'` stops the page from contacting third parties.
- Browser code does not call third-party URLs or analytics SDKs (static check in tests).
- The server does not log request bodies.

**Not guaranteed / outside our control:**

- Tavily receives FinePrint's generic queries from the server's IP. Its retention is governed by Tavily's policies.
- The hosting provider sees standard request metadata (paths, IPs, which topic was researched).
- Browser extensions can read page content.
- The Privacy Audit records requests made by FinePrint's code and requests visible to the Resource Timing API. It does not claim to see browser-level traffic outside the page.
- Research topics reveal coarse information, for example that a lease has a deposit issue. They never include amounts, names or text.

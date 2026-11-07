# FinePrint: Two-Minute Judge Demo

**Setup before presenting**

- Deployed URL (or `npm run build && npm start`) with `TAVILY_API_KEY` set for the live path.
- Open `/analyze?sample=sample-a` once beforehand. This warms the server's 1-hour research cache, so the live demo is instant and doesn't spend extra credits.
- Keep `/analyze?sample=sample-a&research=bundled` in a second tab as the offline fallback.
- Browser window at least 1280px wide for the side-by-side layout.

---

## Script (≈ 2:00)

**0:00 – Problem (15 s)**: Landing page.
> "First-time renters, often students, sign leases under time pressure with $6,000+ due up front. The fine print decides what they really owe. FinePrint shows them before they sign."

**0:15 – Privacy-first upload (20 s)**: Click **Try sample lease**. (Optionally drag `public/samples/fineprint-sample-lease-a.pdf` onto `/analyze` instead.)
> "The PDF is parsed right here in the browser by PDF.js. There is no upload endpoint at all."

**0:35 – Lease Risk Map (30 s)**
- Summary strip: **$1,800/month, $21,600/year, $6,725 due at signing ($2,700 of it refundable), $3,600 early-termination fee.**
- Overview → click **"Security deposit is $900 more than one month's rent."**
- The PDF jumps to the clause, which is **highlighted**. Point at the excerpt with the amount marked, the impact `$2,700 − $1,800 = $900`, and the uncertainty note.

**1:05 – Surge: Tavily research changes the finding (25 s)**: Scroll to **Massachusetts law** in that card.
> "FinePrint sent one generic query to Tavily: 'security deposit limits in Massachusetts.' The source that came back, M.G.L. c. 186 § 15B on malegislature.gov, contains the language this finding relies on, so it is marked *supported by official source*, with link and retrieval time. If no official source had matched, the finding would be downgraded to 'needs review.'"

Optionally open **Early termination fee: $3,600**: "the lease says paying it doesn't release you from rent, so we flag it high and never treat the fee as your full exposure."

**1:30 – Privacy audit (15 s)**: **Privacy** tab.
> "Here is every request that left the browser, with the exact body: just `{"topicId":"ma-security-deposit-limits","jurisdiction":"MA"}`. Zero third-party requests from the page, and a CSP that blocks them anyway."

**1:45 – Startup-ability (15 s)**: **Report** tab. Show the printable report and the editable landlord message.
> "Customer: first-time renters, starting with Massachusetts students. Distribution hypothesis: universities and tenant organizations. Model hypothesis: one-time reports plus institutional licenses, then more states. Not yet validated."

---

## Expected results (Sample A, problematic)

| Item | Value |
| --- | --- |
| Monthly / annual base rent | $1,800 / $21,600 (12-month term) |
| Due at signing | $6,725 = $1,800 first + $1,800 last + $2,700 deposit + $350 move-in fee + $75 key fee |
| Refundable | $2,700 (deposit) |
| Known first-year cost | $22,505 = $21,600 rent + $480 amenity fees + $425 one-time fees |
| Conditional | $75 late fee (after 5 days); $3,600 early-termination fee (in addition to rent until re-rented) |
| Findings | 15 total: **3 high** (deposit over one month's rent; $350 upfront fee; early-termination fee that doesn't release you), **6 medium** (late fee after 5 days; tenant pays water/sewer; shared utility allocation; broad repair duties; auto-renewal with 90-day notice; liability waiver), **3 low** (key fee, attorney's fees, $40/mo amenity fee), **3 info** (rent, 60-day notice, joint and several liability) |
| Legal verification | Live (checked 2026-11-07): official MA sources support every research-backed finding except auto-renewal, which no source supported, so it drops from medium to low and shows "Needs review" (a good moment to show research changing a finding). Bundled mode: same, except auto-renewal shows "verification unavailable". |

**Sample B (cleaner)**: $2,100 rent, $6,350 due at signing, deposit equals one month, late fee only after 30 days, landlord handles repairs and heat/water. **No high or medium findings.** Good for a "compare" moment.

## How each prize track is addressed

| Track | Evidence in the product |
| --- | --- |
| **Privacy-First** | In-browser PDF.js parsing; no upload endpoint; strict `{topicId, jurisdiction}` API that rejects lease text (unit + e2e tests); CSP `connect-src 'self'`; client pre-send guard; Privacy Audit showing exact payloads and Resource Timing observations; no analytics, cookies or storage. |
| **Surge (Tavily)** | Server-side Tavily search per legal topic, official MA domains first with widening if empty, results re-ranked (not first-result-wins), relevant excerpt extraction, timestamps and links. Research **changes findings**: corroborated (kept), not corroborated (downgraded and relabeled), unavailable (explained). |
| **Most Startup-able** | Clear customer and problem, a differentiated product (evidence-backed, private), a printable report and landlord message as the deliverable, and the business model and distribution presented as hypotheses. |

## Fallback if live search fails

- If Tavily is down or the key is missing, the banner says **"Live verification unavailable"** with the reason. Findings then cite **bundled statute excerpts** labeled "Bundled reference, not live" (captured from malegislature.gov on 2026-11-07). Say so explicitly; it demonstrates honest failure handling.
- Or flip the **Live legal search** switch off (demo mode): no research requests are sent at all, which the Privacy tab confirms.
- No network at all: `npm run build && npm start` locally, then use `/analyze?sample=sample-a&fixture=1&research=bundled`.

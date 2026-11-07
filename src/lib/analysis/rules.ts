/**
 * Deterministic finding rules.
 *
 * Each rule reads extracted terms / clauses and emits LeaseFindings with
 * provenance. Rules flag *potential* issues; they never declare a clause
 * illegal. Legal sources are attached later by verify.ts, keeping retrieval
 * separate from conclusions.
 */
import type {
  ExtractedFinancialTerm,
  FinancialSummary,
  FindingVerification,
  LeaseClause,
  LeaseFinding,
  Provenance,
  ResearchTopicId,
} from "@/types/lease";
import { distinctAmounts, primaryTerm } from "./extract";
import { findDayCounts, formatUSD } from "./money";

const PENDING: FindingVerification = {
  status: "pending",
  origin: null,
  supportingSources: [],
  consideredSources: [],
  matchedPhrases: [],
  note: "Legal research has not run yet.",
};
const NOT_APPLICABLE: FindingVerification = {
  status: "not_applicable",
  origin: null,
  supportingSources: [],
  consideredSources: [],
  matchedPhrases: [],
  note: "This finding reports what the lease says; no legal source is needed.",
};

function clauseProv(c: LeaseClause): Provenance {
  return { pageNumber: c.pageNumber, clauseId: c.id, excerpt: c.text, start: c.start, end: c.end };
}

type Draft = Omit<LeaseFinding, "id" | "verification"> & { verification?: FindingVerification };

export interface RuleContext {
  terms: ExtractedFinancialTerm[];
  clauses: LeaseClause[];
  financial: FinancialSummary;
  totalRentStated: { amount: number; provenance: Provenance } | null;
}

const UTILITY_WORDS: [string, RegExp][] = [
  ["heat", /\bheat(?:ing)?\b(?!\s+(?:and|&)\s+hot)/i],
  ["hot water", /\bhot\s+water\b/i],
  ["water/sewer", /\b(?:cold\s+)?water\b(?!\s+heater)|\bsewer\b/i],
  ["electricity", /\belectric(?:ity|al)?\b/i],
  ["gas", /\b(?:natural\s+)?gas\b/i],
  ["internet/cable", /\binternet\b|\bcable\b|\bwi-?fi\b/i],
  ["trash", /\btrash\b|\brubbish\b|\bwaste\s+removal\b/i],
];

const TENANT_PAYS = /\b(?:tenants?|lessees?|residents?)\b[^.]{0,60}?\b(?:shall|will|agrees?\s+to|must|is|are)\b[^.]{0,30}?\b(?:pay|responsible|bear)/i;

export function runRules(ctx: RuleContext): LeaseFinding[] {
  const { terms, clauses, financial } = ctx;
  const drafts: Draft[] = [];
  const rentTerm = primaryTerm(terms, "monthly_rent");
  const rent = financial.monthlyRent;

  // ---------------------------------------------------------------- Rent
  if (rent === null) {
    drafts.push({
      ruleId: "rent-missing",
      category: "rent",
      priority: "medium",
      kind: "missing_information",
      title: "Monthly rent could not be identified",
      explanation:
        "FinePrint did not find a clearly stated monthly rent amount. The lease may express rent differently, or the text may not have extracted cleanly.",
      evidence: [],
      researchTopicIds: [],
      uncertainty: "This may be an extraction limitation rather than a missing term.",
      suggestedAction: "Find the rent clause yourself and enter the amount in the Costs tab so calculations can run.",
      landlordQuestion: "Can you confirm the exact monthly rent and the date it is due each month?",
      verification: NOT_APPLICABLE,
    });
  } else if (rentTerm) {
    const rentValues = distinctAmounts(terms, "monthly_rent");
    drafts.push({
      ruleId: "rent-stated",
      category: "rent",
      priority: "info",
      kind: rentTerm.status === "user_corrected" ? "calculated" : "stated_fact",
      title: `Monthly rent: ${formatUSD(rent)}`,
      explanation: `The lease states monthly rent of ${formatUSD(rent)}, which is ${formatUSD(rent * 12)} per year in base rent${
        financial.termMonths ? ` and ${formatUSD(rent * financial.termMonths)} over the ${financial.termMonths}-month term` : ""
      }.`,
      evidence: rentTerm.provenance ? [rentTerm.provenance] : [],
      financialImpact: { amount: rent * 12, label: "Annual base rent", formula: `${formatUSD(rent)} × 12` },
      researchTopicIds: [],
      uncertainty: rentTerm.status === "ambiguous" ? "The rent amount was inferred from a clause that does not explicitly say 'per month'." : "None for the stated amount.",
      suggestedAction: "Confirm the amount matches what you were quoted.",
      verification: NOT_APPLICABLE,
    });
    if (rentValues.length > 1) {
      drafts.push({
        ruleId: "rent-multiple-values",
        category: "rent",
        priority: "medium",
        kind: "uncertain",
        title: "Lease mentions more than one monthly rent amount",
        explanation: `Different monthly rent figures appear in the lease (${rentValues.map((v) => formatUSD(v)).join(", ")}). This may be a rent schedule, a discount, or an inconsistency.`,
        evidence: terms.filter((t) => t.kind === "monthly_rent" && t.provenance).map((t) => t.provenance as Provenance),
        researchTopicIds: [],
        uncertainty: `FinePrint used ${formatUSD(rent)} for calculations. You can correct this in the Costs tab.`,
        suggestedAction: "Ask the landlord which figure applies and when.",
        landlordQuestion: `The lease lists more than one rent amount (${rentValues.map((v) => formatUSD(v)).join(" and ")}). Which applies, and for which months?`,
        verification: NOT_APPLICABLE,
      });
    }
    if (ctx.totalRentStated && financial.termMonths) {
      const expected = Math.round(rent * financial.termMonths * 100) / 100;
      if (Math.abs(expected - ctx.totalRentStated.amount) > 1) {
        drafts.push({
          ruleId: "rent-total-mismatch",
          category: "rent",
          priority: "medium",
          kind: "calculated",
          title: "Stated total rent does not equal monthly rent × term",
          explanation: `The lease states total rent of ${formatUSD(ctx.totalRentStated.amount)}, but ${formatUSD(rent)} × ${financial.termMonths} months = ${formatUSD(expected)}.`,
          evidence: [ctx.totalRentStated.provenance, ...(rentTerm.provenance ? [rentTerm.provenance] : [])],
          financialImpact: {
            amount: Math.abs(ctx.totalRentStated.amount - expected),
            label: "Difference",
            formula: `|${formatUSD(ctx.totalRentStated.amount)} − ${formatUSD(expected)}|`,
          },
          researchTopicIds: [],
          uncertainty: "Prorated months or concessions can explain a difference.",
          suggestedAction: "Ask for a month-by-month payment schedule.",
          landlordQuestion: "The total rent and the monthly rent don't add up. Can you send a month-by-month payment schedule?",
          verification: NOT_APPLICABLE,
        });
      }
    }
  }

  // ------------------------------------------------------------- Deposit
  const depositTerm = primaryTerm(terms, "security_deposit");
  const deposit = depositTerm ? (financial.upfront.lines.find((l) => l.label === "Security deposit")?.amount ?? depositTerm.amount) : null;
  if (depositTerm && deposit !== null && rent !== null) {
    if (deposit > rent + 0.005) {
      const excess = Math.round((deposit - rent) * 100) / 100;
      drafts.push({
        ruleId: "deposit-exceeds-rent",
        category: "deposit",
        priority: "high",
        kind: "potential_conflict",
        title: `Security deposit is ${formatUSD(excess)} more than one month's rent`,
        explanation: `The lease requires a ${formatUSD(deposit)} security deposit with monthly rent of ${formatUSD(rent)} — ${(deposit / rent).toFixed(2)}× the monthly rent. Massachusetts law appears to cap a residential security deposit at the first month's rent; see the cited source.`,
        evidence: depositTerm.provenance ? [depositTerm.provenance, ...(rentTerm?.provenance ? [rentTerm.provenance] : [])] : [],
        financialImpact: { amount: excess, label: "Amount above one month's rent", formula: `${formatUSD(deposit)} − ${formatUSD(rent)}` },
        researchTopicIds: ["ma-security-deposit-limits"],
        uncertainty:
          "FinePrint compares the two numbers stated in the lease. It cannot know about arrangements outside the document, and this is not a legal determination. Housing types or programs with different rules may apply.",
        suggestedAction: "Ask the landlord to reduce the deposit to no more than one month's rent before signing, and get the corrected amount in writing.",
        landlordQuestion: `The lease lists a ${formatUSD(deposit)} security deposit, which is more than one month's rent (${formatUSD(rent)}). Could you revise the deposit to ${formatUSD(rent)} or less?`,
      });
    } else {
      drafts.push({
        ruleId: "deposit-within-rent",
        category: "deposit",
        priority: "info",
        kind: "stated_fact",
        title: `Security deposit: ${formatUSD(deposit)}`,
        explanation: `The deposit (${formatUSD(deposit)}) does not exceed one month's rent (${formatUSD(rent)}). It is refundable and is not counted as a cost.`,
        evidence: depositTerm.provenance ? [depositTerm.provenance] : [],
        researchTopicIds: [],
        uncertainty: "Refund depends on move-out condition and the landlord following deposit-handling requirements.",
        suggestedAction: "When you pay, ask for a signed receipt and a written statement of the unit's condition, and keep copies.",
        landlordQuestion: "Will I receive a receipt for the security deposit and a statement of the apartment's condition?",
        verification: NOT_APPLICABLE,
      });
    }
  }

  // --------------------------------------------------- Last month's rent
  const lastTerm = primaryTerm(terms, "last_month_rent");
  if (lastTerm?.amount != null && rent !== null && lastTerm.amount > rent + 0.005) {
    drafts.push({
      ruleId: "last-month-exceeds-rent",
      category: "upfront",
      priority: "medium",
      kind: "potential_conflict",
      title: "Prepaid last month's rent is higher than monthly rent",
      explanation: `The lease asks for ${formatUSD(lastTerm.amount)} as last month's rent while monthly rent is ${formatUSD(rent)}. Massachusetts law appears to require last month's rent to be calculated at the same rate as the first month.`,
      evidence: lastTerm.provenance ? [lastTerm.provenance] : [],
      financialImpact: { amount: lastTerm.amount - rent, label: "Excess", formula: `${formatUSD(lastTerm.amount)} − ${formatUSD(rent)}` },
      researchTopicIds: ["ma-upfront-charges"],
      uncertainty: "Check whether the figure includes something other than rent.",
      suggestedAction: "Ask for last month's rent to equal the regular monthly rent.",
      landlordQuestion: `Why is last month's rent ${formatUSD(lastTerm.amount)} rather than the regular ${formatUSD(rent)}?`,
    });
  }

  // ------------------------------------------------------ Upfront fees
  const feeTerms = terms.filter((t) => t.kind === "one_time_fee" && t.amount !== null);
  const isKeyLock = (label: string) => /\b(key|lock)\b/i.test(label);
  const flagged = feeTerms.filter((f) => !isKeyLock(f.label) && (f.dueAtSigning || f.refundable === false));
  if (flagged.length) {
    const total = flagged.reduce((a, f) => a + (f.amount as number), 0);
    const hasBroker = flagged.some((f) => /broker|realtor|agent/i.test(f.label));
    drafts.push({
      ruleId: "upfront-extra-fees",
      category: "upfront",
      priority: "high",
      kind: "potential_conflict",
      title: `${flagged.length} upfront fee${flagged.length > 1 ? "s" : ""} beyond rent, deposit and lock/key (${formatUSD(total)})`,
      explanation: `The lease charges ${flagged.map((f) => `${f.label.toLowerCase()} (${formatUSD(f.amount)})`).join(", ")} at or before move-in. Massachusetts law appears to limit what a landlord may require at the start of a tenancy to first month's rent, last month's rent, a security deposit and the cost of a lock and key.`,
      evidence: flagged.map((f) => f.provenance).filter((p): p is Provenance => p !== null),
      financialImpact: { amount: total, label: "Upfront fees at issue", formula: flagged.map((f) => formatUSD(f.amount)).join(" + ") },
      researchTopicIds: ["ma-upfront-charges"],
      uncertainty: `Classification is based on the fee's wording and timing in the lease.${
        hasBroker ? " Broker fees depend on who hired the broker; a broker you hired yourself may be treated differently." : ""
      } This is not a legal determination.`,
      suggestedAction: "Ask the landlord to remove these fees or explain the legal basis in writing before you pay anything.",
      landlordQuestion: `The lease includes ${flagged.map((f) => `a ${f.label.toLowerCase()} of ${formatUSD(f.amount)}`).join(" and ")}. Can these be removed, or can you explain what they cover and the basis for charging them?`,
    });
  }
  const keyFees = feeTerms.filter((f) => isKeyLock(f.label));
  if (keyFees.length) {
    drafts.push({
      ruleId: "upfront-key-fee",
      category: "upfront",
      priority: "low",
      kind: "uncertain",
      title: "Lock/key charge",
      explanation: `The lease includes ${keyFees.map((f) => `${f.label.toLowerCase()} (${formatUSD(f.amount)})`).join(", ")}. Massachusetts law appears to allow the purchase and installation cost of a key and lock at move-in.`,
      evidence: keyFees.map((f) => f.provenance).filter((p): p is Provenance => p !== null),
      financialImpact: { amount: keyFees.reduce((a, f) => a + (f.amount as number), 0), label: "Key/lock charges", formula: keyFees.map((f) => formatUSD(f.amount)).join(" + ") },
      researchTopicIds: ["ma-upfront-charges"],
      uncertainty: "Whether the amount reflects the actual cost of a new lock and key is not stated.",
      suggestedAction: "Ask whether the charge is for a new lock and key and request a receipt.",
      landlordQuestion: "Is the key/lock charge for the purchase and installation of a new lock? Can I get a receipt?",
    });
  }

  // --------------------------------------------------------- Late fees
  for (const late of terms.filter((t) => t.kind === "late_fee")) {
    const grace = late.detail?.graceDays;
    const amountText = late.amount !== null ? formatUSD(late.amount) : null;
    const impact = late.amount !== null
      ? { financialImpact: { amount: late.amount, label: late.detail?.perDay ? "Per day late" : "Per late payment", formula: "As stated" } }
      : {};
    if (typeof grace === "number" && grace < 30) {
      drafts.push({
        ruleId: "late-fee-before-30-days",
        category: "fees",
        priority: "medium",
        kind: "potential_conflict",
        title: `Late fee applies ${grace} day${grace === 1 ? "" : "s"} after rent is due`,
        explanation: `The lease imposes ${amountText ? `a ${amountText}` : "a"} late charge ${grace} day(s) after rent is due. Massachusetts law appears to bar interest or penalties for late rent until 30 days after it was due.`,
        evidence: late.provenance ? [late.provenance] : [],
        ...impact,
        researchTopicIds: ["ma-late-fees"],
        uncertainty: "Timing was read from the clause text and could be misread if the clause is unusual. This is not a legal determination.",
        suggestedAction: "Ask for the late fee to apply no sooner than 30 days after rent is due.",
        landlordQuestion: `The lease charges a late fee ${grace} day(s) after rent is due. Would you change this so no late fee applies until 30 days after the due date?`,
      });
    } else if (typeof grace === "number") {
      drafts.push({
        ruleId: "late-fee-after-30-days",
        category: "fees",
        priority: "info",
        kind: "stated_fact",
        title: `Late fee${amountText ? ` of ${amountText}` : ""} after ${grace} days`,
        explanation: `The lease imposes a late charge only once rent is ${grace} days overdue.`,
        evidence: late.provenance ? [late.provenance] : [],
        ...impact,
        researchTopicIds: [],
        uncertainty: "None for the stated timing.",
        suggestedAction: "Pay on time; note the amount in case of a late month.",
        verification: NOT_APPLICABLE,
      });
    } else {
      drafts.push({
        ruleId: "late-fee-timing-unclear",
        category: "fees",
        priority: "low",
        kind: "uncertain",
        title: amountText ? `Late fee of ${amountText} (timing unclear)` : "Late fee clause (timing unclear)",
        explanation: "The lease includes a late-payment charge, but FinePrint could not determine when it applies.",
        evidence: late.provenance ? [late.provenance] : [],
        ...impact,
        researchTopicIds: ["ma-late-fees"],
        uncertainty: "The timing may be stated in wording FinePrint does not recognize.",
        suggestedAction: "Ask exactly when a late charge would apply.",
        landlordQuestion: "When exactly would a late fee be charged, and how much is it?",
      });
    }
  }

  // -------------------------------------------------- Early termination
  const etfs = terms.filter((t) => t.kind === "early_termination_fee");
  for (const etf of etfs) {
    const inAddition = Boolean(etf.detail?.inAdditionTo);
    // Include the qualifying sentence that follows in the same section, if any.
    const ci = etf.provenance ? clauses.findIndex((c) => c.id === etf.provenance!.clauseId) : -1;
    const next = ci >= 0 ? clauses[ci + 1] : undefined;
    const qualifier =
      next && next.pageNumber === clauses[ci].pageNumber && next.heading === clauses[ci].heading &&
      /\b(?:release|relieve|liab|in\s+addition|in\s+lieu|responsible)\w*/i.test(next.text)
        ? clauseProv(next)
        : null;
    drafts.push({
      ruleId: "early-termination-fee",
      category: "termination",
      priority: inAddition ? "high" : "medium",
      kind: "stated_fact",
      title: etf.amount !== null ? `Early termination fee: ${formatUSD(etf.amount)}` : `Early termination fee: ${etf.relativeExpression}`,
      explanation: `${
        etf.amount !== null ? `Ending the lease early costs ${formatUSD(etf.amount)}${etf.relativeExpression ? ` (${etf.relativeExpression})` : ""}.` : `Ending the lease early costs ${etf.relativeExpression}; monthly rent is needed to calculate this.`
      } ${inAddition ? "The clause says this is in addition to other obligations, so your total cost to leave early could be considerably higher." : etf.detail?.inLieuOf ? "The clause appears to say the fee replaces further rent obligations." : "The clause does not clearly say whether paying the fee releases you from remaining rent."}`,
      evidence: etf.provenance ? [etf.provenance, ...(qualifier ? [qualifier] : [])] : [],
      ...(etf.amount !== null
        ? { financialImpact: { amount: etf.amount, label: "Conditional: only if you leave early", formula: etf.detail?.months ? `${etf.detail.months} × monthly rent` : "As stated" } }
        : {}),
      researchTopicIds: [],
      uncertainty: "A stated fee does not by itself mean other obligations (such as rent until the unit is re-rented) end. FinePrint does not calculate those.",
      suggestedAction: "Get written confirmation of exactly what you would owe if you had to leave early.",
      landlordQuestion: inAddition
        ? "If I end the lease early and pay the termination fee, what else would I owe? Would you agree that the fee fully releases me?"
        : "If I pay the early termination fee, am I released from all remaining rent and obligations?",
      verification: NOT_APPLICABLE,
    });
  }
  if (etfs.length === 0 && clauses.length > 0) {
    drafts.push({
      ruleId: "early-termination-missing",
      category: "termination",
      priority: "low",
      kind: "missing_information",
      title: "No early-termination option found",
      explanation: "FinePrint did not find a clause describing how you could end the lease early or what it would cost.",
      evidence: [],
      researchTopicIds: [],
      uncertainty: "The lease may address this in wording FinePrint does not recognize.",
      suggestedAction: "Ask how an early move-out would be handled before signing.",
      landlordQuestion: "If I need to move out before the lease ends, what would happen and what would I owe?",
      verification: NOT_APPLICABLE,
    });
  }

  // ------------------------------------------------ Clause-based rules
  const seen = new Set<string>();
  const once = (key: string) => (seen.has(key) ? false : (seen.add(key), true));

  for (const c of clauses) {
    const t = c.text;

    // Maintenance / repairs shifted to tenant
    if (
      /\b(?:tenants?|lessees?)\b[^.]{0,80}\b(?:responsible\s+for|shall\s+(?:make|perform|pay\s+for)|bear\s+(?:the\s+)?(?:full\s+)?cost\s+of|at\s+(?:tenant|lessee)['’]?s?\s+(?:sole\s+)?(?:own\s+)?(?:cost|expense))\b[^.]{0,140}\b(?:repairs?|maintenance|replace\w*)\b/i.test(t) ||
      /\b(?:repairs?|maintenance)\b[^.]{0,60}\b(?:at|shall\s+be\s+(?:at|the))\s+(?:the\s+)?(?:tenant|lessee)['’]?s?\s+(?:sole\s+)?(?:cost|expense|responsibility)/i.test(t)
    ) {
      const broad = /\ball\s+repairs\b|\bstructural\b|\bheating\b|\bplumbing\b|\bappliances?\b|\bregardless\s+of\s+(?:the\s+)?cause\b|\bmajor\b|\belectrical\b|\broof\b/i.test(t);
      const minor = /\blight\s*bulbs?\b|\bsmoke\s+detector\s+batter/i.test(t) && !broad;
      // Responsibility limited to damage the tenant causes is ordinary; don't flag it.
      const tenantCausedOnly =
        /\b(?:caused\s+by\s+(?:the\s+)?(?:tenants?|lessees?)|(?:tenant|lessee)['’]?s?\s+(?:own\s+)?(?:negligence|misuse|guests?|invitees?)|beyond\s+(?:normal|ordinary|reasonable)\s+wear)/i.test(t) &&
        !/\ball\s+repairs\b|\bregardless\s+of\s+(?:the\s+)?cause\b/i.test(t);
      const capMatch = t.match(/\bfirst\s+(\$\s?[\d,]+(?:\.\d{2})?)\b/i);
      if (!minor && !tenantCausedOnly && once(`maint-${c.id}`)) {
        drafts.push({
          ruleId: "maintenance-shifted-to-tenant",
          category: "maintenance",
          priority: broad ? "medium" : "low",
          kind: broad ? "potential_conflict" : "uncertain",
          title: broad ? "Broad repair responsibilities placed on tenant" : "Tenant repair responsibility",
          explanation: `This clause makes the tenant responsible for ${broad ? "repairs that may include systems the landlord is ordinarily required to maintain" : "certain repairs or maintenance"}.${capMatch ? ` It specifies the tenant pays the first ${capMatch[1]} of repairs.` : ""} In Massachusetts, landlords have duties to keep rental housing in safe, code-compliant condition that a lease may not be able to waive.`,
          evidence: [clauseProv(c)],
          researchTopicIds: ["ma-repair-obligations"],
          uncertainty: "Tenants can be responsible for damage they cause. Whether this clause goes further depends on its exact wording and the condition at issue.",
          suggestedAction: "Ask the landlord to limit tenant repair costs to damage caused by the tenant or guests.",
          landlordQuestion: "Who is responsible for repairs to heating, plumbing, electrical and appliances that aren't caused by me? Could the lease limit my responsibility to damage I cause?",
        });
      }
    }

    // Utilities
    const mentionsUtility = /\butilit(?:y|ies)\b|\bheat\b|\bhot\s+water\b|\belectric|\bgas\b|\bwater\b|\bsewer\b/i.test(t);
    const shared = /\b(?:allocat\w*|apportion\w*|divided|shared|pro-?rat\w*|ratio)\b[^.]{0,60}\b(?:units?|tenants?|occupants?|building)\b|\bratio\s+utility\b|\bRUBS\b/i.test(t);
    if (mentionsUtility && shared && once("util-shared")) {
      drafts.push({
        ruleId: "utilities-shared-allocation",
        category: "utilities",
        priority: "medium",
        kind: "potential_conflict",
        title: "Utility costs split among units instead of metered",
        explanation:
          "The lease allocates some utility costs among units or occupants rather than billing your own metered usage. Massachusetts law appears to allow charging tenants for water only through certified submeters, and prohibits transferring utility payment responsibility without the tenant's knowledge or consent.",
        evidence: [clauseProv(c)],
        researchTopicIds: ["ma-utilities-billing"],
        uncertainty: "FinePrint cannot see how the building is metered, and an allocation formula makes your cost unpredictable. Not a legal determination.",
        suggestedAction: "Ask how each shared charge is calculated and request past bills; ask whether water is submetered.",
        landlordQuestion: "How are the shared utility charges calculated, and what have they been in past months? Is water billed through a certified submeter for my unit?",
      });
    }
    if (mentionsUtility && TENANT_PAYS.test(t)) {
      const landlordProvides = /\b(?:landlord|lessor|owner)\b[^.]{0,40}\b(?:shall|will)\s+(?:provide|pay|furnish)/i.test(t);
      const utils = UTILITY_WORDS.filter(([, re]) => re.test(t)).map(([n]) => n);
      if (utils.length && !landlordProvides && once(`util-${c.id}`)) {
        const water = utils.includes("water/sewer");
        drafts.push({
          ruleId: water ? "utilities-water" : "utilities-tenant-pays",
          category: "utilities",
          priority: water ? "medium" : "low",
          kind: water ? "potential_conflict" : "stated_fact",
          title: `Tenant pays: ${utils.join(", ")}`,
          explanation: water
            ? `The lease makes the tenant responsible for ${utils.join(", ")}. Massachusetts law appears to allow charging tenants for water only through properly installed and certified submeters.`
            : `The lease makes the tenant responsible for ${utils.join(", ")}. These are ongoing costs not included in rent.`,
          evidence: [clauseProv(c)],
          researchTopicIds: water ? ["ma-utilities-billing"] : [],
          uncertainty: "FinePrint cannot see how the building is metered. Utility costs are not included in calculations because amounts are usually not stated.",
          suggestedAction: water ? "Ask whether each utility you pay is separately metered for your unit." : "Ask for typical monthly utility costs for the unit.",
          landlordQuestion: water
            ? "Is each utility I'd pay separately metered for my unit? For water, is there a certified submeter?"
            : `What have typical monthly costs been for ${utils.join(", ")} in this unit?`,
          ...(water ? {} : { verification: NOT_APPLICABLE }),
        });
      }
    }

    // Automatic renewal
    if (/\bautomatic(?:ally)?\s+(?:be\s+)?(?:renew|extend)|\bauto-?renew|\b(?:renew|extend|continue)\w*\s+automatically\b|\bshall\s+(?:be\s+)?(?:renewed|extended)\s+for\s+(?:an?\s+)?(?:additional|successive|further)\b/i.test(t) && once("renewal")) {
      const days = findDayCounts(t).map((d) => d.days);
      const notice = days.length ? Math.max(...days) : null;
      drafts.push({
        ruleId: "auto-renewal",
        category: "renewal",
        priority: notice !== null && notice >= 60 ? "medium" : "low",
        kind: "uncertain",
        title: notice !== null ? `Automatic renewal unless you give ${notice} days' notice` : "Automatic renewal clause",
        explanation: `The lease renews or extends automatically unless notice is given${notice !== null ? ` at least ${notice} days in advance` : ""}. Missing the deadline could commit you to another term.`,
        evidence: [clauseProv(c)],
        researchTopicIds: ["ma-lease-renewal"],
        uncertainty: "Massachusetts may impose conditions on automatic renewal clauses; FinePrint does not determine whether this clause is enforceable.",
        suggestedAction: "Put the notice deadline in your calendar, or ask to remove automatic renewal.",
        landlordQuestion: "Could the automatic renewal be removed, or could you agree to remind me in writing before the notice deadline?",
      });
    }

    // Notice to vacate (not renewal)
    if (!/\bautomatic/i.test(t) && /\b(?:notice|notify)\b[^.]{0,80}\b(?:vacat\w*|move\s+out|terminat\w*|not\s+(?:to\s+)?renew|non-?renewal)\b/i.test(t) && once("notice")) {
      const days = findDayCounts(t).map((d) => d.days);
      if (days.length) {
        drafts.push({
          ruleId: "notice-period",
          category: "renewal",
          priority: "info",
          kind: "stated_fact",
          title: `${Math.max(...days)}-day written notice required`,
          explanation: `The lease requires ${Math.max(...days)} days' notice in connection with moving out, non-renewal or termination.`,
          evidence: [clauseProv(c)],
          researchTopicIds: [],
          uncertainty: "Read the clause to confirm who must give notice and how.",
          suggestedAction: "Note the deadline relative to your lease end date.",
          verification: NOT_APPLICABLE,
        });
      }
    }

    // Liability waiver
    if (
      /\b(?:landlord|lessor|owner|management)\b[^.]{0,60}\b(?:not\s+(?:be\s+)?(?:liable|responsible)|no\s+liability)\b[^.]{0,80}\b(?:injur\w*|damage|loss|harm)\b/i.test(t) ||
      /\bhold\s+(?:the\s+)?(?:landlord|lessor|owner)\b[^.]{0,30}\bharmless\b|\b(?:waives?|releases?)\s+(?:any\s+and\s+all|all|any)\s+claims\b[^.]{0,60}\b(?:landlord|lessor|owner)\b/i.test(t)
    ) {
      if (once("liability")) {
        drafts.push({
          ruleId: "liability-waiver",
          category: "liability",
          priority: "medium",
          kind: "potential_conflict",
          title: "Clause limits the landlord's liability",
          explanation:
            "This clause attempts to excuse the landlord from liability for injury, loss or damage, or requires you to hold the landlord harmless. Massachusetts law appears to make lease provisions void to the extent they exempt a landlord from liability for its own negligence.",
          evidence: [clauseProv(c)],
          researchTopicIds: ["ma-landlord-liability-waiver"],
          uncertainty: "A clause covering only damage the landlord did not cause may be treated differently. FinePrint does not determine enforceability.",
          suggestedAction: "Ask to narrow the clause to exclude the landlord's own negligence. Consider renter's insurance for your belongings.",
          landlordQuestion: "Could the liability clause be revised so it does not cover injury or damage caused by the landlord's own negligence?",
        });
      }
    }

    // One-sided attorney fees
    if (/\battorney['’]?s?['’]?\s+fees\b/i.test(t) && /\b(?:landlord|lessor|owner)\b/i.test(t) && /\b(?:tenant|lessee)\b/i.test(t) && once("attorney")) {
      drafts.push({
        ruleId: "attorney-fees",
        category: "liability",
        priority: "low",
        kind: "uncertain",
        title: "Attorney's fees clause",
        explanation:
          "The lease lets the landlord recover attorney's fees from the tenant. In Massachusetts, when a residential lease includes such a clause, a reciprocal right for the tenant appears to be implied by law.",
        evidence: [clauseProv(c)],
        researchTopicIds: ["ma-attorney-fees"],
        uncertainty: "FinePrint flags the clause; how it applies depends on the dispute.",
        suggestedAction: "Be aware of potential legal-cost exposure in a dispute.",
        verification: undefined,
      });
    }

    // Joint and several liability (multiple tenants)
    if (/\bjointly\s+and\s+severally\b/i.test(t) && once("joint")) {
      drafts.push({
        ruleId: "joint-several",
        category: "general",
        priority: "info",
        kind: "stated_fact",
        title: "Each tenant is responsible for the full rent",
        explanation:
          "The lease makes tenants 'jointly and severally' liable. If a roommate stops paying, the landlord may seek the entire rent or damages from any one tenant.",
        evidence: [clauseProv(c)],
        researchTopicIds: [],
        uncertainty: "Common in shared leases; consider a written agreement among roommates.",
        suggestedAction: "Agree in writing with roommates how rent and deposits are split.",
        verification: NOT_APPLICABLE,
      });
    }
  }

  // Ambiguous fees (no clear label or no amount)
  const ambiguous = terms.filter((t) => (t.kind === "one_time_fee" || t.kind === "recurring_fee") && t.status === "ambiguous");
  if (ambiguous.length) {
    drafts.push({
      ruleId: "ambiguous-fees",
      category: "fees",
      priority: "low",
      kind: "uncertain",
      title: "Charges with unclear purpose",
      explanation: `FinePrint found ${ambiguous.length} charge(s) whose purpose is not clearly labeled: ${ambiguous.map((a) => formatUSD(a.amount)).join(", ")}.`,
      evidence: ambiguous.map((a) => a.provenance).filter((p): p is Provenance => p !== null),
      researchTopicIds: [],
      uncertainty: "These may be legitimate charges described in unusual wording.",
      suggestedAction: "Ask what each charge is for and whether it is refundable.",
      landlordQuestion: "Can you explain what each of these charges covers and whether any are refundable?",
      verification: NOT_APPLICABLE,
    });
  }

  // Recurring fees
  const recurring = terms.filter((t) => t.kind === "recurring_fee" && t.amount !== null && t.status !== "ambiguous");
  if (recurring.length) {
    const monthly = recurring.reduce((a, r) => a + (r.amount as number), 0);
    drafts.push({
      ruleId: "recurring-fees",
      category: "fees",
      priority: "low",
      kind: "calculated",
      title: `Monthly fees on top of rent: ${formatUSD(monthly)}`,
      explanation: `The lease adds ${recurring.map((r) => `${r.label.toLowerCase()} (${formatUSD(r.amount)}/month)`).join(", ")} to rent.`,
      evidence: recurring.map((r) => r.provenance).filter((p): p is Provenance => p !== null),
      financialImpact: { amount: monthly * 12, label: "Per year", formula: `${formatUSD(monthly)} × 12` },
      researchTopicIds: [],
      uncertainty: "Whether these fees are optional is not always clear from the text.",
      suggestedAction: "Ask whether each monthly fee is optional.",
      landlordQuestion: `Are the monthly ${recurring.map((r) => r.label.toLowerCase()).join(" and ")} required, or optional?`,
      verification: NOT_APPLICABLE,
    });
  }

  return drafts.map((d, i) => ({
    ...d,
    id: `f${i + 1}-${d.ruleId}`,
    verification: d.verification ?? (d.researchTopicIds.length ? PENDING : NOT_APPLICABLE),
  }));
}

export const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, info: 3 } as const;

export function sortFindings(findings: LeaseFinding[]): LeaseFinding[] {
  return [...findings].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export function collectResearchTopics(findings: LeaseFinding[]): ResearchTopicId[] {
  return [...new Set(findings.flatMap((f) => f.researchTopicIds))];
}

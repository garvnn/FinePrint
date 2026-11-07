/**
 * Deterministic financial-term extraction.
 *
 * For every clause, each dollar amount is classified by the cue words in its
 * immediate context (between the previous and next amount). Every term keeps
 * provenance (page, clause, character offsets). Amounts we cannot classify are
 * ignored rather than guessed.
 */
import type { ExtractedFinancialTerm, LeaseClause, LeasePage, Provenance } from "@/types/lease";
import { findDayCounts, findLeaseTermMonths, findMoney, findMonthsOfRent, type MoneyMatch } from "./money";

type MoneyKind =
  | "late_fee"
  | "early_termination_fee"
  | "last_month_rent"
  | "first_month_rent"
  | "security_deposit"
  | "total_rent"
  | "monthly_rent"
  | "fee"
  | "rent_plain"
  | "ignore";

const RE = {
  late: /\blate\s+(?:fee|charge|payment\s+fee|penalty)|\bif\s+(?:any\s+)?(?:rent|payment)\s+is\s+(?:not\s+)?(?:paid|received)|\bpast\s+due\b|\bafter\s+the\s+\w+\s+day\b/i,
  earlyTerm:
    /\bearly\s+termination|\bterminat\w*\s+(?:this\s+lease\s+|the\s+lease\s+)?(?:early|prior\s+to|before)|\bbreak(?:ing)?\s+(?:the|this)\s+lease|\blease[-\s]break|\bbuy-?out\b/i,
  lastMonth: /\blast\s+(?:full\s+)?month['’]?s?['’]?\s+rent|\brent\s+for\s+the\s+last\s+(?:full\s+)?month/i,
  firstMonth: /\bfirst\s+(?:full\s+)?month['’]?s?['’]?\s+rent|\brent\s+for\s+the\s+first\s+(?:full\s+)?month/i,
  deposit: /\b(?:security|damage)\s+deposit\b/i,
  totalRent: /\btotal\s+rent\b|\b(?:annual|yearly)\s+rent\b|\bfor\s+the\s+(?:entire|full|whole)\s+(?:lease\s+)?term\b|\bper\s+(?:year|annum)\b/i,
  monthly: /\b(?:per|each|a|every)\s+(?:calendar\s+)?month\b|\bmonthly\b|\binstall?ments?\b|\/\s?mo(?:nth)?\b/i,
  rent: /\brent\b/i,
  fee: /\bfees?\b|\bcharges?\b/i,
  feeRightAfter: /^\s*(?:\([^)]*\)\s*)?(?:non-?refundable\s+|one-?time\s+|monthly\s+)?(?:[a-z'’-]+\s+){0,3}(?:fee|charge)s?\b/i,
  deductedFromDeposit: /deduct\w*\s+from\s+(?:the\s+)?(?:security\s+)?deposit/i,
  nonRefundable: /\bnon-?refundable\b/i,
  refundable: /\brefundable\b/i,
  dueAtSigning:
    /\b(?:at|upon|prior\s+to|before)\s+(?:the\s+)?(?:lease\s+)?(?:signing|move-?in|execution|commencement|occupancy|the\s+start)|\bdue\s+at\s+(?:lease\s+)?signing\b|\bupon\s+execution\b|\bmove-?in\s+(?:fee|charge|costs?)\b/i,
};

/** End offset of the last match of `re` in `s`, or -1. */
function lastMatchEnd(s: string, re: RegExp): number {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let end = -1;
  for (const m of s.matchAll(g)) end = m.index! + m[0].length;
  return end;
}

/** Start offset of the first match of `re` in `s`, or Infinity. */
function firstMatchStart(s: string, re: RegExp): number {
  const m = s.match(re);
  return m?.index ?? Number.POSITIVE_INFINITY;
}

const SPECIFIC: [Exclude<MoneyKind, "ignore">, RegExp][] = [
  ["late_fee", RE.late],
  ["early_termination_fee", RE.earlyTerm],
  ["last_month_rent", RE.lastMonth],
  ["first_month_rent", RE.firstMonth],
  ["security_deposit", RE.deposit],
];
const GENERIC: [Exclude<MoneyKind, "ignore">, RegExp][] = [
  ["total_rent", RE.totalRent],
  ["fee", RE.fee],
  ["fee", /\b(?:lock|key)s?\b/i],
  ["rent_plain", RE.rent],
];

/**
 * Classify one dollar amount from its local context. `before` and `after`
 * are bounded by neighbouring amounts, so list items ("(a) first month's rent
 * $X; (b) last month's rent $Y") are classified independently.
 *
 * Order: an explicit "<label> fee" right after the amount → specific cues
 * before the amount (closest wins) → generic cues before → cues after.
 */
export function classify(before: string, after: string): MoneyKind {
  const b = before.slice(-90);
  const a = after.slice(0, 60);
  // "$150 cleaning fee will be deducted from the deposit" — a fee, not the deposit.
  if (RE.feeRightAfter.test(after) && !RE.deposit.test(after.slice(0, 25))) return "fee";

  const refine = (k: Exclude<MoneyKind, "ignore">): MoneyKind => {
    if (k === "security_deposit" && RE.deductedFromDeposit.test(b + a)) return "fee";
    if (k === "rent_plain") {
      if (/^\s*(?:\)\s*)?(?:per\s+(?:year|annum)|annually)\b/i.test(a)) return "total_rent";
      return RE.monthly.test(b) || RE.monthly.test(a) ? "monthly_rent" : "rent_plain";
    }
    return k;
  };

  const closest = (list: [Exclude<MoneyKind, "ignore">, RegExp][]) => {
    let best: Exclude<MoneyKind, "ignore"> | null = null;
    let bestEnd = -1;
    for (const [k, re] of list) {
      const e = lastMatchEnd(b, re);
      if (e > bestEnd) {
        best = k;
        bestEnd = e;
      }
    }
    return best;
  };

  const specific = closest(SPECIFIC);
  if (specific) return refine(specific);
  const generic = closest(GENERIC);
  if (generic) return refine(generic);

  let best: Exclude<MoneyKind, "ignore"> | null = null;
  let bestStart = Number.POSITIVE_INFINITY;
  for (const [k, re] of [...SPECIFIC, ...GENERIC]) {
    const s = firstMatchStart(a, re);
    if (s < bestStart) {
      best = k;
      bestStart = s;
    }
  }
  return best ? refine(best) : "ignore";
}

const FEE_LABEL_BEFORE = /([A-Za-z'’-]+(?:\s+[A-Za-z'’-]+){0,2})\s+(?:fee|charge)s?\s*(?:of|in\s+the\s+amount\s+of|equal\s+to|:)?\s*$/i;
const FEE_LABEL_AFTER = /^\s*(?:\([^)]*\)\s*)?((?:[A-Za-z'’-]+\s+){0,3}?)(fee|charge)s?\b/i;
const LABEL_STOPWORDS = /\b(?:a|an|the|non-?refundable|refundable|one-?time|monthly|additional|following|shall|pay|tenant|tenants|will|be|of|and|is|are|to|due|also|for|this|lease|per|month|each|plus)\b/gi;

export function feeLabel(before: string, after: string): string {
  const pick = (s: string | undefined) => {
    if (!s) return "";
    return s.replace(LABEL_STOPWORDS, " ").replace(/\s+/g, " ").trim();
  };
  const a = after.match(FEE_LABEL_AFTER);
  let label = pick(a?.[1]);
  if (!label) {
    const b = before.slice(-60).match(FEE_LABEL_BEFORE);
    label = pick(b?.[1]);
  }
  if (!label && /\b(?:lock|keys?)\b/i.test(before.slice(-50))) return "Lock and key cost";
  if (!label) return "Additional fee";
  const words = label.split(" ").slice(-3).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase() + " fee";
}

function provenanceFor(clause: LeaseClause, m?: { start: number; end: number }): Provenance {
  return {
    pageNumber: clause.pageNumber,
    clauseId: clause.id,
    excerpt: clause.text,
    start: clause.start,
    end: clause.end,
    ...(m ? { matchStart: clause.start + m.start, matchEnd: clause.start + m.end } : {}),
  };
}

export interface ExtractionResult {
  terms: ExtractedFinancialTerm[];
  /** Total rent for the term, if stated (used as a cross-check). */
  totalRentStated: { amount: number; provenance: Provenance } | null;
}

export function extractFinancialTerms(clauses: LeaseClause[], pages: LeasePage[]): ExtractionResult {
  const pageText = new Map(pages.map((p) => [p.pageNumber, p.text]));
  const terms: ExtractedFinancialTerm[] = [];
  let totalRentStated: ExtractionResult["totalRentStated"] = null;
  let n = 0;
  const id = (k: string) => `t${++n}-${k}`;

  clauses.forEach((clause, ci) => {
    // Same-length normalization keeps offsets aligned with the page text.
    const raw = (pageText.get(clause.pageNumber) ?? "").slice(clause.start, clause.end).replace(/\n/g, " ");
    // The following sentence in the same section often qualifies this one
    // ("Payment of this fee shall not release Tenant ...").
    const next = clauses[ci + 1];
    const sectionContext =
      next && next.pageNumber === clause.pageNumber && next.heading === clause.heading ? `${raw} ${next.text}` : raw;
    const money = findMoney(raw);
    const nonRefundable = RE.nonRefundable.test(raw);
    const dueAtSigning = RE.dueAtSigning.test(raw);

    money.forEach((m: MoneyMatch, i: number) => {
      const before = raw.slice(i > 0 ? money[i - 1].end : 0, m.start);
      const after = raw.slice(m.end, i < money.length - 1 ? money[i + 1].start : raw.length);
      const kind = classify(before, after);
      const prov = provenanceFor(clause, m);
      const nearAfter = after.slice(0, 40);
      const nearBefore = before.slice(-40);
      const recurring = RE.monthly.test(nearAfter) || /\bmonthly\b/i.test(nearBefore);
      const localNonRefundable = RE.nonRefundable.test(nearBefore + nearAfter) || (nonRefundable && money.length === 1);

      switch (kind) {
        case "monthly_rent":
        case "rent_plain":
          terms.push({
            id: id("rent"),
            kind: "monthly_rent",
            label: "Monthly rent",
            amount: m.amount,
            frequency: "monthly",
            refundable: false,
            dueAtSigning: false,
            status: kind === "monthly_rent" ? "stated" : "ambiguous",
            provenance: prov,
          });
          break;
        case "total_rent":
          if (!totalRentStated) totalRentStated = { amount: m.amount, provenance: prov };
          break;
        case "security_deposit":
          terms.push({
            id: id("deposit"),
            kind: "security_deposit",
            label: "Security deposit",
            amount: m.amount,
            frequency: "one_time",
            refundable: true,
            dueAtSigning: true,
            status: "stated",
            provenance: prov,
          });
          break;
        case "first_month_rent":
          terms.push({
            id: id("first"),
            kind: "first_month_rent",
            label: "First month's rent",
            amount: m.amount,
            frequency: "one_time",
            refundable: false,
            dueAtSigning: true,
            status: "stated",
            provenance: prov,
          });
          break;
        case "last_month_rent":
          terms.push({
            id: id("last"),
            kind: "last_month_rent",
            label: "Last month's rent (prepaid)",
            amount: m.amount,
            frequency: "one_time",
            refundable: false,
            dueAtSigning: true,
            status: "stated",
            provenance: prov,
          });
          break;
        case "late_fee": {
          const perDay = /\bper\s+day\b|\beach\s+day\b|\bdaily\b/i.test(nearAfter);
          terms.push({
            id: id("late"),
            kind: "late_fee",
            label: perDay ? "Late fee (per day)" : "Late fee",
            amount: m.amount,
            frequency: "conditional",
            refundable: false,
            dueAtSigning: false,
            status: "stated",
            detail: { ...lateFeeTiming(raw), perDay },
            provenance: prov,
          });
          break;
        }
        case "early_termination_fee":
          terms.push({
            id: id("etf"),
            kind: "early_termination_fee",
            label: "Early termination fee",
            amount: m.amount,
            frequency: "conditional",
            refundable: false,
            dueAtSigning: false,
            status: "stated",
            detail: earlyTerminationDetail(sectionContext),
            provenance: prov,
          });
          break;
        case "fee": {
          const label = feeLabel(before, after);
          const isRefundableDeposit = /deposit/i.test(label) && !localNonRefundable;
          terms.push({
            id: id("fee"),
            kind: recurring ? "recurring_fee" : "one_time_fee",
            label,
            amount: m.amount,
            frequency: recurring ? "monthly" : "one_time",
            refundable: localNonRefundable ? false : isRefundableDeposit ? true : RE.refundable.test(nearBefore + nearAfter) ? true : null,
            dueAtSigning: !recurring && (dueAtSigning || localNonRefundable),
            status: label === "Additional fee" ? "ambiguous" : "stated",
            provenance: prov,
          });
          break;
        }
        case "ignore":
          break;
      }
    });

    // Amounts expressed relative to rent (no dollar figure).
    const rel = findMonthsOfRent(raw);
    if (rel) {
      const ctxStart = Math.max(0, rel.start - 140);
      const ctx = raw.slice(ctxStart, rel.end + 40);
      const prov = provenanceFor(clause, rel);
      const hasDollarNearby = money.some((m) => Math.abs(m.start - rel.start) < 60);
      if (RE.earlyTerm.test(ctx) && !hasDollarNearby) {
        terms.push({
          id: id("etf"),
          kind: "early_termination_fee",
          label: "Early termination fee",
          amount: null,
          frequency: "conditional",
          refundable: false,
          dueAtSigning: false,
          status: "derived",
          relativeExpression: rel.raw,
          detail: { months: rel.months, ...earlyTerminationDetail(sectionContext) },
          provenance: prov,
        });
      } else if (RE.deposit.test(ctx) && !hasDollarNearby) {
        terms.push({
          id: id("deposit"),
          kind: "security_deposit",
          label: "Security deposit",
          amount: null,
          frequency: "one_time",
          refundable: true,
          dueAtSigning: true,
          status: "derived",
          relativeExpression: rel.raw,
          detail: { months: rel.months },
          provenance: prov,
        });
      }
    }

    // Lease term.
    const term = findLeaseTermMonths(raw);
    if (term && !terms.some((t) => t.kind === "lease_term")) {
      terms.push({
        id: id("term"),
        kind: "lease_term",
        label: "Lease term (months)",
        amount: term.months,
        frequency: "unknown",
        refundable: null,
        dueAtSigning: false,
        status: "stated",
        provenance: provenanceFor(clause, term),
      });
    }

    // A late-fee clause with no dollar amount (e.g. "5% of the monthly rent").
    if (RE.late.test(raw) && /\bfee|charge|penalt/i.test(raw) && money.length === 0) {
      const pct = raw.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/i);
      terms.push({
        id: id("late"),
        kind: "late_fee",
        label: pct ? `Late fee (${pct[1]}% of rent)` : "Late fee (amount not stated)",
        amount: null,
        frequency: "conditional",
        refundable: false,
        dueAtSigning: false,
        status: "ambiguous",
        detail: { ...lateFeeTiming(raw), ...(pct ? { percent: Number(pct[1]) } : {}) },
        provenance: provenanceFor(clause),
      });
    }
  });

  return { terms: resolveDerived(terms), totalRentStated };
}

/** Days after the due date before a late fee applies, if stated. */
export function lateFeeTiming(text: string): { graceDays?: number } {
  const ordinal = text.match(/\bafter\s+the\s+(\d{1,2})(?:st|nd|rd|th)\s+(?:day\s+)?(?:of\s+(?:the|each)\s+month)?/i);
  if (ordinal) return { graceDays: Math.max(0, Number(ordinal[1]) - 1) };
  const days = findDayCounts(text);
  if (days.length) return { graceDays: days[0].days };
  return {};
}

function earlyTerminationDetail(text: string): Record<string, boolean> {
  const inAdditionTo =
    /\bin\s+addition\s+to\b|\bremain(?:s)?\s+(?:liable|responsible)\b|\bcontinue\s+to\s+be\s+(?:liable|responsible)\b|\b(?:shall|will|does)\s+not\s+(?:release|relieve)\b/i.test(text);
  const inLieuOf =
    !inAdditionTo &&
    /\bin\s+lieu\s+of\b|\b(?:fully\s+)?release[sd]?\s+(?:the\s+)?tenant\b|\bno\s+further\s+(?:rent|obligation|liability)\b/i.test(text);
  return { inAdditionTo, inLieuOf };
}

/** Fill in amounts expressed in months of rent once monthly rent is known. */
function resolveDerived(terms: ExtractedFinancialTerm[]): ExtractedFinancialTerm[] {
  const rent = primaryTerm(terms, "monthly_rent")?.amount ?? null;
  if (rent === null) return terms;
  return terms.map((t) =>
    t.status === "derived" && t.amount === null && typeof t.detail?.months === "number"
      ? { ...t, amount: Math.round(rent * (t.detail.months as number) * 100) / 100 }
      : t,
  );
}

/**
 * The most reliable term of a kind: user-corrected beats stated beats
 * derived beats ambiguous; ties go to the earliest occurrence.
 */
export function primaryTerm(
  terms: ExtractedFinancialTerm[],
  kind: ExtractedFinancialTerm["kind"],
): ExtractedFinancialTerm | undefined {
  const order = { user_corrected: 0, stated: 1, derived: 2, ambiguous: 3 } as const;
  return terms
    .filter((t) => t.kind === kind)
    .sort((a, b) => order[a.status] - order[b.status])[0];
}

/** Distinct stated amounts for a kind (to detect conflicting values). */
export function distinctAmounts(terms: ExtractedFinancialTerm[], kind: ExtractedFinancialTerm["kind"]): number[] {
  return [...new Set(terms.filter((t) => t.kind === kind && t.amount !== null && t.status !== "ambiguous").map((t) => t.amount as number))];
}

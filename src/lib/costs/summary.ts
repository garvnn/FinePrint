/**
 * Deterministic financial exposure calculator. Pure functions, no I/O.
 *
 * Separation rules:
 *  - Base rent, one-time fees, refundable deposits, conditional penalties and
 *    unknowns are kept in separate buckets.
 *  - Refundable deposits are never counted as a cost.
 *  - Prepaid first/last month's rent is cash due up front but is rent, not an
 *    additional charge, so it is not double-counted in first-year cost.
 *  - A stated early-termination fee is shown as a conditional amount and is
 *    never presented as the full extent of early-exit liability.
 */
import type {
  ConditionalCharge,
  ExtractedFinancialTerm,
  FinancialOverrides,
  FinancialSummary,
  FormulaLine,
  MoneyLine,
} from "@/types/lease";
import { primaryTerm } from "@/lib/analysis/extract";
import { formatUSD } from "@/lib/analysis/money";

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));

function pick(override: number | null | undefined, term: ExtractedFinancialTerm | undefined): number | null {
  if (override !== undefined) return override;
  return term?.amount ?? null;
}

export function computeFinancialSummary(
  terms: ExtractedFinancialTerm[],
  overrides: FinancialOverrides = {},
): FinancialSummary {
  const rentTerm = primaryTerm(terms, "monthly_rent");
  const depositTerm = primaryTerm(terms, "security_deposit");
  const lastTerm = primaryTerm(terms, "last_month_rent");
  const firstTerm = primaryTerm(terms, "first_month_rent");
  const leaseTerm = primaryTerm(terms, "lease_term");

  const monthlyRent = pick(overrides.monthlyRent, rentTerm);
  const termMonths = pick(overrides.termMonths, leaseTerm);
  const deposit = pick(overrides.securityDeposit, depositTerm);
  const lastMonth = pick(overrides.lastMonthRent, lastTerm);
  const firstMonth = firstTerm?.amount ?? monthlyRent;

  const unknowns: string[] = [];
  const formulas: FormulaLine[] = [];

  const annualBaseRent = monthlyRent !== null ? round2(monthlyRent * 12) : null;
  const termBaseRent = monthlyRent !== null && termMonths !== null ? round2(monthlyRent * termMonths) : null;
  const firstYearMonths = termMonths !== null ? Math.min(12, termMonths) : 12;

  if (monthlyRent === null) unknowns.push("Monthly rent was not found in the lease. Enter it in the Costs tab to complete calculations.");
  if (termMonths === null) unknowns.push("Lease length was not detected; first-year figures assume 12 months of occupancy.");

  formulas.push({
    label: "Annual base rent",
    formula: monthlyRent !== null ? `${formatUSD(monthlyRent)} × 12 months` : "monthly rent × 12 (monthly rent unknown)",
    value: annualBaseRent,
  });
  if (termMonths !== null) {
    formulas.push({
      label: "Base rent over full lease term",
      formula: monthlyRent !== null ? `${formatUSD(monthlyRent)} × ${termMonths} months` : `monthly rent × ${termMonths} months`,
      value: termBaseRent,
    });
  }

  // ---- Upfront ----------------------------------------------------------
  const upfront: MoneyLine[] = [];
  if (firstMonth !== null) {
    upfront.push({ label: "First month's rent", amount: firstMonth, refundable: false, termId: firstTerm?.id ?? rentTerm?.id });
    if (!firstTerm) {
      unknowns.push("The lease does not separately state when first month's rent is due; it is assumed due at or before move-in.");
    }
  }
  if (lastMonth !== null) upfront.push({ label: "Last month's rent (prepaid)", amount: lastMonth, refundable: false, termId: lastTerm?.id });
  if (deposit !== null) upfront.push({ label: "Security deposit", amount: deposit, refundable: true, termId: depositTerm?.id });
  if (depositTerm && depositTerm.amount === null && deposit === null) {
    unknowns.push(`The security deposit is described as "${depositTerm.relativeExpression}" but monthly rent is unknown.`);
  }

  const oneTimeFees = terms.filter((t) => t.kind === "one_time_fee" && t.amount !== null);
  const upfrontFees = oneTimeFees.filter((t) => t.dueAtSigning);
  const otherOneTimeFees = oneTimeFees.filter((t) => !t.dueAtSigning);
  for (const f of upfrontFees) upfront.push({ label: f.label, amount: f.amount as number, refundable: f.refundable, termId: f.id });
  for (const f of otherOneTimeFees) {
    unknowns.push(`${f.label} (${formatUSD(f.amount)}): the lease does not clearly state when it is due; counted in first-year cost, not in upfront cash.`);
  }
  for (const f of oneTimeFees.filter((t) => t.refundable === null)) {
    unknowns.push(`${f.label}: refundability is not stated; treated as non-refundable.`);
  }

  const prepaidRent = sum(upfront.filter((l) => /month's rent/.test(l.label)).map((l) => l.amount));
  const refundable = sum(upfront.filter((l) => l.refundable === true).map((l) => l.amount));
  const upfrontTotal = sum(upfront.map((l) => l.amount));
  const nonRefundable = round2(upfrontTotal - refundable - prepaidRent);

  formulas.push({
    label: "Upfront cash required",
    formula: upfront.length ? upfront.map((l) => `${l.label} ${formatUSD(l.amount)}`).join(" + ") : "No upfront amounts identified",
    value: upfrontTotal,
  });
  formulas.push({
    label: "Refundable portion (not a cost)",
    formula: refundable ? upfront.filter((l) => l.refundable === true).map((l) => `${l.label} ${formatUSD(l.amount)}`).join(" + ") : "None identified",
    value: refundable,
  });

  // ---- Recurring --------------------------------------------------------
  const recurringFees: MoneyLine[] = terms
    .filter((t) => t.kind === "recurring_fee" && t.amount !== null)
    .map((t) => ({ label: t.label, amount: t.amount as number, refundable: false, termId: t.id }));
  const recurringMonthly = sum(recurringFees.map((l) => l.amount));
  const recurringFeesAnnual = round2(recurringMonthly * firstYearMonths);
  if (recurringFees.length) {
    formulas.push({
      label: "Recurring fees, first year",
      formula: `${formatUSD(recurringMonthly)}/month × ${firstYearMonths} months`,
      value: recurringFeesAnnual,
    });
  }

  const oneTimeNonRefundableFees = sum(oneTimeFees.filter((t) => t.refundable !== true).map((t) => t.amount as number));

  // ---- First year known cost -------------------------------------------
  let firstYearKnownCost: number | null = null;
  if (monthlyRent !== null) {
    firstYearKnownCost = round2(monthlyRent * firstYearMonths + recurringFeesAnnual + oneTimeNonRefundableFees);
    formulas.push({
      label: "Known first-year contractual cost",
      formula: `rent ${formatUSD(monthlyRent)} × ${firstYearMonths} + recurring fees ${formatUSD(recurringFeesAnnual)} + one-time non-refundable fees ${formatUSD(oneTimeNonRefundableFees)} (excludes refundable deposit; prepaid rent is already part of rent)`,
      value: firstYearKnownCost,
    });
  }

  // ---- Conditional ------------------------------------------------------
  const conditional: ConditionalCharge[] = [];
  for (const t of terms.filter((x) => x.kind === "late_fee")) {
    const grace = t.detail?.graceDays;
    conditional.push({
      label: t.label,
      amount: t.amount,
      trigger: typeof grace === "number" ? `Rent paid more than ${grace} day(s) late` : "Rent paid late (timing not clearly stated)",
      note: t.amount === null ? "Amount not stated as a dollar figure." : t.detail?.perDay ? "Charged per day; total depends on how late." : "Per late payment.",
      termId: t.id,
    });
  }
  for (const t of terms.filter((x) => x.kind === "early_termination_fee")) {
    const months = t.detail?.months;
    const note = t.detail?.inAdditionTo
      ? "The lease states this is IN ADDITION TO other obligations (e.g. continued rent). Total exposure may be higher."
      : t.detail?.inLieuOf
        ? "The lease appears to say this fee replaces further rent obligations. Confirm in writing."
        : "The lease does not clearly say whether paying this fee ends other obligations. Do not assume it does.";
    conditional.push({
      label: t.label,
      amount: t.amount,
      trigger: "You end the lease before the term expires",
      note,
      termId: t.id,
    });
    if (typeof months === "number") {
      formulas.push({
        label: "Early termination fee",
        formula: monthlyRent !== null ? `${months} × monthly rent ${formatUSD(monthlyRent)}` : `${months} × monthly rent (rent unknown)`,
        value: t.amount ?? (monthlyRent !== null ? round2(months * monthlyRent) : null),
      });
    }
  }
  for (const t of terms.filter((x) => (x.kind === "one_time_fee" || x.kind === "recurring_fee") && x.amount === null)) {
    unknowns.push(`${t.label}: mentioned without a dollar amount.`);
  }

  return {
    monthlyRent,
    termMonths,
    annualBaseRent,
    termBaseRent,
    upfront: { lines: upfront, total: upfrontTotal, refundable, nonRefundable, prepaidRent },
    recurringFees,
    recurringFeesAnnual,
    oneTimeNonRefundableFees,
    firstYearKnownCost,
    conditional,
    unknowns,
    formulas,
  };
}

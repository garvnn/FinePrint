/**
 * Orchestrator: LeaseDocument → AnalysisResult. Pure and synchronous; runs in
 * the browser (and in Node tests). No network access.
 */
import type { AnalysisResult, ExtractedFinancialTerm, FinancialOverrides, LeaseDocument } from "@/types/lease";
import { segmentDocument } from "./segment";
import { extractFinancialTerms } from "./extract";
import { collectResearchTopics, runRules, sortFindings } from "./rules";
import { computeFinancialSummary } from "@/lib/costs/summary";

function applyOverrides(terms: ExtractedFinancialTerm[], o: FinancialOverrides): ExtractedFinancialTerm[] {
  const map: [keyof FinancialOverrides, ExtractedFinancialTerm["kind"], string][] = [
    ["monthlyRent", "monthly_rent", "Monthly rent"],
    ["securityDeposit", "security_deposit", "Security deposit"],
    ["lastMonthRent", "last_month_rent", "Last month's rent (prepaid)"],
    ["termMonths", "lease_term", "Lease term (months)"],
  ];
  let out = terms;
  for (const [key, kind, label] of map) {
    const v = o[key];
    if (v === undefined) continue;
    const existing = out.find((t) => t.kind === kind);
    const corrected: ExtractedFinancialTerm = {
      id: existing?.id ?? `user-${kind}`,
      kind,
      label,
      amount: v,
      frequency: kind === "monthly_rent" ? "monthly" : kind === "lease_term" ? "unknown" : "one_time",
      refundable: kind === "security_deposit" ? true : kind === "lease_term" ? null : false,
      dueAtSigning: kind === "security_deposit" || kind === "last_month_rent",
      status: "user_corrected",
      provenance: existing?.provenance ?? null,
    };
    out = [corrected, ...out.filter((t) => t.kind !== kind)];
  }
  // Re-derive amounts expressed in months of rent (e.g. "two months' rent").
  const rent = out.find((t) => t.kind === "monthly_rent" && t.status === "user_corrected")?.amount;
  if (typeof rent === "number") {
    out = out.map((t) =>
      typeof t.detail?.months === "number" && t.relativeExpression
        ? { ...t, amount: Math.round(rent * (t.detail.months as number) * 100) / 100 }
        : t,
    );
  }
  return out;
}

export function analyzeLease(document: LeaseDocument, overrides: FinancialOverrides = {}): AnalysisResult {
  const clauses = segmentDocument(document.pages);
  const extraction = extractFinancialTerms(clauses, document.pages);
  const terms = applyOverrides(extraction.terms, overrides);
  const financial = computeFinancialSummary(terms);
  const findings = sortFindings(
    runRules({ terms, clauses, financial, totalRentStated: extraction.totalRentStated }),
  );
  return {
    document,
    clauses,
    terms,
    financial,
    findings,
    researchTopics: collectResearchTopics(findings),
    analyzedAt: new Date().toISOString(),
  };
}

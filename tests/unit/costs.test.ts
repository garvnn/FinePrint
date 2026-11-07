import { describe, expect, it } from "vitest";
import type { ExtractedFinancialTerm } from "@/types/lease";
import { computeFinancialSummary } from "@/lib/costs/summary";
import { analyzeLease } from "@/lib/analysis/analyze";
import { textDoc } from "../helpers/text-doc";

let n = 0;
function term(partial: Partial<ExtractedFinancialTerm> & Pick<ExtractedFinancialTerm, "kind" | "amount">): ExtractedFinancialTerm {
  return {
    id: `x${++n}`,
    label: partial.kind,
    frequency: "one_time",
    refundable: null,
    dueAtSigning: false,
    status: "stated",
    provenance: null,
    ...partial,
  } as ExtractedFinancialTerm;
}

const base = [
  term({ kind: "monthly_rent", amount: 1800, frequency: "monthly", refundable: false }),
  term({ kind: "lease_term", amount: 12 }),
  term({ kind: "first_month_rent", amount: 1800, dueAtSigning: true, refundable: false }),
  term({ kind: "last_month_rent", amount: 1800, dueAtSigning: true, refundable: false }),
  term({ kind: "security_deposit", amount: 2700, dueAtSigning: true, refundable: true }),
  term({ kind: "one_time_fee", amount: 350, label: "Move-in fee", dueAtSigning: true, refundable: false }),
  term({ kind: "one_time_fee", amount: 75, label: "Key fee", dueAtSigning: true, refundable: null }),
  term({ kind: "recurring_fee", amount: 40, label: "Amenity fee", frequency: "monthly" }),
  term({ kind: "early_termination_fee", amount: 3600, frequency: "conditional", detail: { inAdditionTo: true } }),
];

describe("computeFinancialSummary", () => {
  const s = computeFinancialSummary(base);

  it("computes annual and term base rent", () => {
    expect(s.annualBaseRent).toBe(21600);
    expect(s.termBaseRent).toBe(21600);
  });
  it("computes upfront cash and separates refundable deposit and prepaid rent", () => {
    expect(s.upfront.total).toBe(1800 + 1800 + 2700 + 350 + 75);
    expect(s.upfront.refundable).toBe(2700);
    expect(s.upfront.prepaidRent).toBe(3600);
    expect(s.upfront.nonRefundable).toBe(425);
  });
  it("never counts the refundable deposit as a first-year cost", () => {
    expect(s.firstYearKnownCost).toBe(21600 + 480 + 425);
    expect(s.firstYearKnownCost).not.toBe(21600 + 480 + 425 + 2700);
  });
  it("keeps termination penalties conditional and warns about other obligations", () => {
    const etf = s.conditional.find((c) => c.label === "early_termination_fee" || c.amount === 3600)!;
    expect(etf.amount).toBe(3600);
    expect(etf.note).toMatch(/IN ADDITION TO/);
    expect(s.firstYearKnownCost).toBeLessThan(21600 + 480 + 425 + 3600);
  });
  it("flags unknown refundability", () => {
    expect(s.unknowns.some((u) => u.includes("Key fee") && u.includes("refundability"))).toBe(true);
  });
  it("shows formulas for each calculation", () => {
    expect(s.formulas.map((f) => f.label)).toEqual(
      expect.arrayContaining(["Annual base rent", "Upfront cash required", "Known first-year contractual cost"]),
    );
  });
  it("handles missing rent without inventing numbers", () => {
    const m = computeFinancialSummary([term({ kind: "security_deposit", amount: 1000, refundable: true, dueAtSigning: true })]);
    expect(m.monthlyRent).toBeNull();
    expect(m.annualBaseRent).toBeNull();
    expect(m.firstYearKnownCost).toBeNull();
    expect(m.unknowns[0]).toMatch(/Monthly rent was not found/);
  });
  it("caps first-year months to a shorter term", () => {
    const short = computeFinancialSummary([
      term({ kind: "monthly_rent", amount: 1000, frequency: "monthly" }),
      term({ kind: "lease_term", amount: 6 }),
      term({ kind: "recurring_fee", amount: 10, frequency: "monthly" }),
    ]);
    expect(short.firstYearKnownCost).toBe(6000 + 60);
    expect(short.annualBaseRent).toBe(12000);
  });
  it("applies user overrides", () => {
    const o = computeFinancialSummary(base, { monthlyRent: 2000, securityDeposit: 2000 });
    expect(o.annualBaseRent).toBe(24000);
    expect(o.upfront.refundable).toBe(2000);
  });
});

describe("overrides through analyzeLease", () => {
  it("recomputes findings with corrected values", () => {
    const doc = textDoc("Rent is $1,000.00 per month. Tenant shall pay a security deposit of $1,500.00.");
    expect(analyzeLease(doc).findings.some((f) => f.ruleId === "deposit-exceeds-rent")).toBe(true);
    const corrected = analyzeLease(doc, { monthlyRent: 1500 });
    expect(corrected.findings.some((f) => f.ruleId === "deposit-exceeds-rent")).toBe(false);
    expect(corrected.terms.find((t) => t.kind === "monthly_rent")?.status).toBe("user_corrected");
  });
});

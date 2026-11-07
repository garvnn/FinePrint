import { describe, expect, it } from "vitest";
import { analyzeText } from "../helpers/text-doc";
import { primaryTerm } from "@/lib/analysis/extract";
import { segmentPage } from "@/lib/analysis/segment";
import { buildPageFromText } from "@/lib/pdf/layout";

describe("segmentation", () => {
  it("tracks headings and keeps exact offsets", () => {
    const page = buildPageFromText(1, "2. RENT\nTenant shall pay monthly rent of $1,800.00. Rent is due on the first.\n\n3. DEPOSIT\nA deposit of $900 is due.");
    const clauses = segmentPage(page);
    expect(clauses.map((c) => c.heading)).toEqual(["2. RENT", "2. RENT", "3. DEPOSIT"]);
    for (const c of clauses) expect(page.text.slice(c.start, c.end).replace(/\s+/g, " ")).toBe(c.text);
  });
});

describe("rent extraction", () => {
  it("extracts monthly rent with provenance", () => {
    const r = analyzeText("RENT\nTenant shall pay monthly rent of $1,800.00, payable on the first day of each month.");
    const rent = primaryTerm(r.terms, "monthly_rent")!;
    expect(rent.amount).toBe(1800);
    expect(rent.status).toBe("stated");
    expect(rent.provenance?.pageNumber).toBe(1);
    const page = r.document.pages[0].text;
    expect(page.slice(rent.provenance!.matchStart, rent.provenance!.matchEnd)).toBe("$1,800.00");
  });
  it("does not confuse total rent with monthly rent", () => {
    const r = analyzeText("Rent is $1,500.00 per month. The total rent for the term is $18,000.00.");
    expect(primaryTerm(r.terms, "monthly_rent")?.amount).toBe(1500);
    expect(r.terms.filter((t) => t.kind === "monthly_rent").map((t) => t.amount)).toEqual([1500]);
  });
  it("reports missing rent as missing information", () => {
    const r = analyzeText("Tenant agrees to keep the premises clean. Rent will be provided in a separate schedule.");
    expect(primaryTerm(r.terms, "monthly_rent")).toBeUndefined();
    const f = r.findings.find((x) => x.ruleId === "rent-missing")!;
    expect(f.kind).toBe("missing_information");
    expect(r.financial.monthlyRent).toBeNull();
  });
  it("flags multiple conflicting monthly rents", () => {
    const r = analyzeText("Monthly rent is $1,800.00 per month. Beginning in month seven, monthly rent is $1,900.00 per month.");
    expect(r.findings.some((f) => f.ruleId === "rent-multiple-values")).toBe(true);
  });
});

describe("deposit and upfront extraction", () => {
  it("classifies each amount in a list clause independently", () => {
    const r = analyzeText(
      "At lease signing, Tenant shall pay: (a) first month's rent of $1,800.00; (b) last month's rent of $1,800.00; (c) the security deposit of $2,700.00; (d) a non-refundable move-in fee of $350.00; and (e) a key fee of $75.00. Monthly rent is $1,800.00 per month.",
    );
    const kinds = r.terms.filter((t) => t.provenance?.matchStart !== undefined).map((t) => [t.kind, t.amount]);
    expect(kinds).toEqual(
      expect.arrayContaining([
        ["first_month_rent", 1800],
        ["last_month_rent", 1800],
        ["security_deposit", 2700],
        ["one_time_fee", 350],
        ["one_time_fee", 75],
        ["monthly_rent", 1800],
      ]),
    );
    const moveIn = r.terms.find((t) => t.amount === 350)!;
    expect(moveIn.label).toBe("Move-in fee");
    expect(moveIn.refundable).toBe(false);
    expect(moveIn.dueAtSigning).toBe(true);
  });
  it("extracts a deposit stated relative to rent", () => {
    const r = analyzeText("Monthly rent is $2,000.00 per month. Tenant shall pay a security deposit equal to one and one-half months' rent.");
    const dep = primaryTerm(r.terms, "security_deposit")!;
    expect(dep.status).toBe("derived");
    expect(dep.amount).toBe(3000);
    expect(r.findings.some((f) => f.ruleId === "deposit-exceeds-rent")).toBe(true);
  });
  it("treats a fee deducted from the deposit as a fee, not the deposit", () => {
    const r = analyzeText("Rent is $1,000.00 per month. A $150.00 cleaning fee will be deducted from the security deposit.");
    expect(r.terms.find((t) => t.amount === 150)?.kind).toBe("one_time_fee");
    expect(primaryTerm(r.terms, "security_deposit")).toBeUndefined();
  });
  it("marks unlabeled charges as ambiguous", () => {
    const r = analyzeText("Rent is $1,000.00 per month. Tenant shall also pay a charge of $95.00 at move-in.");
    const t = r.terms.find((x) => x.amount === 95)!;
    expect(t.status).toBe("ambiguous");
    expect(r.findings.some((f) => f.ruleId === "ambiguous-fees")).toBe(true);
  });
});

describe("late fees and early termination", () => {
  it("reads late fee grace period", () => {
    const r = analyzeText("Rent is $1,000.00 per month. If any rent payment is not received within five (5) days after its due date, Tenant shall pay a late fee of $50.00.");
    const late = r.terms.find((t) => t.kind === "late_fee")!;
    expect(late.amount).toBe(50);
    expect(late.detail?.graceDays).toBe(5);
    expect(r.findings.find((f) => f.ruleId === "late-fee-before-30-days")?.priority).toBe("medium");
  });
  it("does not flag a late fee after 30 days", () => {
    const r = analyzeText("Rent is $1,000.00 per month. If rent remains unpaid thirty (30) days after its due date, Tenant shall pay a late charge of $50.00.");
    expect(r.findings.some((f) => f.ruleId === "late-fee-before-30-days")).toBe(false);
    expect(r.findings.some((f) => f.ruleId === "late-fee-after-30-days")).toBe(true);
  });
  it("computes a months-of-rent termination fee and detects 'in addition to' language", () => {
    const r = analyzeText(
      "Rent is $1,500.00 per month.\n\nEARLY TERMINATION\nTenant may terminate early by paying an early termination fee equal to two (2) months' rent. Payment of this fee shall not release Tenant from liability for rent until the Premises are re-rented.",
    );
    const etf = r.terms.find((t) => t.kind === "early_termination_fee")!;
    expect(etf.amount).toBe(3000);
    expect(etf.detail?.inAdditionTo).toBe(true);
    const f = r.findings.find((x) => x.ruleId === "early-termination-fee")!;
    expect(f.priority).toBe("high");
    expect(f.uncertainty).toMatch(/does not by itself mean other obligations/);
  });
});

describe("clause rules", () => {
  it("does not flag tenant responsibility limited to tenant-caused damage", () => {
    const r = analyzeText("Tenant shall be responsible for the cost of repairing damage caused by Tenant or Tenant's guests beyond normal wear and tear.");
    expect(r.findings.some((f) => f.category === "maintenance")).toBe(false);
  });
  it("flags broad repair duties", () => {
    const r = analyzeText("Tenant shall be responsible for all repairs to the Premises, including plumbing and heating.");
    expect(r.findings.find((f) => f.category === "maintenance")?.kind).toBe("potential_conflict");
  });
  it("detects multiple tenants with joint and several liability", () => {
    const r = analyzeText("If more than one person signs this Lease as Tenant, each is jointly and severally liable for all obligations.");
    expect(r.findings.some((f) => f.ruleId === "joint-several")).toBe(true);
  });
  it("does not invent findings for unrecognized provisions", () => {
    const r = analyzeText("Tenant may keep one cat. Quiet hours are from 10pm to 7am. Bicycles must be stored in the basement.");
    expect(r.findings.map((f) => f.ruleId).sort()).toEqual(["early-termination-missing", "rent-missing"]);
  });
  it("every finding with evidence points to a real clause on its page", () => {
    const r = analyzeText("Rent is $1,000.00 per month.", "Tenant shall pay a security deposit of $1,500.00.");
    for (const f of r.findings) {
      for (const e of f.evidence) {
        const page = r.document.pages[e.pageNumber - 1];
        expect(page.text.slice(e.start, e.end).replace(/\s+/g, " ")).toBe(e.excerpt);
      }
    }
    expect(r.findings.find((f) => f.ruleId === "deposit-exceeds-rent")?.evidence[0].pageNumber).toBe(2);
  });
});

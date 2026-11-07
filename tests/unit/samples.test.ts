import { describe, expect, it } from "vitest";
import { analyzeLease } from "@/lib/analysis/analyze";
import { applyResearch } from "@/lib/analysis/verify";
import { bundledResearch } from "@/lib/research/client";
import { SAMPLE_A, SAMPLE_B, sampleToDocument } from "@/lib/fixtures/sample-leases";
import { FIXTURE, loadPdfInNode, SAMPLE_A_PATH, SAMPLE_B_PATH } from "../helpers/node-pdf";

describe("Sample A (problematic) parsed from the real PDF", async () => {
  const doc = await loadPdfInNode(SAMPLE_A_PATH);
  const r = analyzeLease(doc);
  const ids = r.findings.map((f) => f.ruleId);

  it("extracts text from every page", () => {
    expect(doc.hasExtractableText).toBe(true);
    expect(doc.pageCount).toBe(2);
    expect(doc.pages.every((p) => p.spans.length > 0)).toBe(true);
  });

  it("computes the correct financial summary", () => {
    const f = r.financial;
    expect(f.monthlyRent).toBe(1800);
    expect(f.termMonths).toBe(12);
    expect(f.annualBaseRent).toBe(21600);
    expect(f.upfront.total).toBe(6725);
    expect(f.upfront.refundable).toBe(2700);
    expect(f.recurringFeesAnnual).toBe(480);
    expect(f.firstYearKnownCost).toBe(22505);
    expect(f.conditional.find((c) => c.label === "Early termination fee")?.amount).toBe(3600);
  });

  it("produces the expected findings", () => {
    expect(ids).toEqual(
      expect.arrayContaining([
        "deposit-exceeds-rent",
        "upfront-extra-fees",
        "upfront-key-fee",
        "late-fee-before-30-days",
        "early-termination-fee",
        "utilities-water",
        "utilities-shared-allocation",
        "maintenance-shifted-to-tenant",
        "auto-renewal",
        "liability-waiver",
        "attorney-fees",
        "joint-several",
        "recurring-fees",
      ]),
    );
    expect(r.findings).toHaveLength(15); // matches the landing-page illustration
    const dep = r.findings.find((f) => f.ruleId === "deposit-exceeds-rent")!;
    expect(dep.priority).toBe("high");
    expect(dep.financialImpact?.amount).toBe(900);
    expect(r.findings.find((f) => f.ruleId === "early-termination-fee")!.priority).toBe("high");
    expect(r.findings.find((f) => f.ruleId === "auto-renewal")!.title).toContain("90 days");
  });

  it("keeps page-level provenance that maps to highlightable PDF spans", () => {
    const pageOf = (id: string) => r.findings.find((f) => f.ruleId === id)!.evidence[0].pageNumber;
    expect(pageOf("deposit-exceeds-rent")).toBe(1);
    expect(pageOf("early-termination-fee")).toBe(2);
    for (const f of r.findings) {
      for (const e of f.evidence) {
        const page = doc.pages[e.pageNumber - 1];
        const spans = page.spans.filter((s) => s.end > e.start && s.start < e.end);
        expect(spans.length, `${f.ruleId} p${e.pageNumber}`).toBeGreaterThan(0);
      }
    }
  });

  it("every research-backed finding is corroborated by bundled statute text except auto-renewal", () => {
    const map = Object.fromEntries(r.researchTopics.map((t) => [t, bundledResearch(t, "test")]));
    const out = applyResearch(r.findings, map);
    for (const f of out.filter((x) => x.researchTopicIds.length)) {
      if (f.ruleId === "auto-renewal") expect(f.verification.status).toBe("unavailable");
      else expect(f.verification.status, f.ruleId).toBe("corroborated");
    }
  });

  it("fixture mode (no PDF) yields the same findings", () => {
    const fx = analyzeLease(sampleToDocument(SAMPLE_A));
    expect(fx.findings.map((f) => f.ruleId).sort()).toEqual([...ids].sort());
  });
});

describe("Sample B (cleaner) parsed from the real PDF", async () => {
  const doc = await loadPdfInNode(SAMPLE_B_PATH);
  const r = analyzeLease(doc);

  it("computes the correct financial summary", () => {
    expect(r.financial.monthlyRent).toBe(2100);
    expect(r.financial.termMonths).toBe(12);
    expect(r.financial.upfront.total).toBe(6350);
    expect(r.financial.upfront.refundable).toBe(2100);
  });
  it("has no high- or medium-priority findings", () => {
    expect(r.findings.filter((f) => f.priority === "high" || f.priority === "medium")).toEqual([]);
    expect(r.findings.some((f) => f.ruleId === "deposit-within-rent")).toBe(true);
    expect(r.findings.some((f) => f.ruleId === "late-fee-after-30-days")).toBe(true);
  });
  it("fixture mode matches", () => {
    expect(analyzeLease(sampleToDocument(SAMPLE_B)).findings.map((f) => f.ruleId).sort()).toEqual(r.findings.map((f) => f.ruleId).sort());
  });
});

describe("PDF edge cases", () => {
  it("detects a scanned PDF with no extractable text", async () => {
    const doc = await loadPdfInNode(FIXTURE("scanned.pdf"));
    expect(doc.hasExtractableText).toBe(false);
  });
  it("handles a lease with no rent amount", async () => {
    const r = analyzeLease(await loadPdfInNode(FIXTURE("no-rent.pdf")));
    expect(r.findings.some((f) => f.ruleId === "rent-missing")).toBe(true);
  });
  it("rejects a non-PDF and an empty file in the parser", async () => {
    await expect(loadPdfInNode(FIXTURE("not-a-pdf.pdf"))).rejects.toThrow();
    await expect(loadPdfInNode(FIXTURE("empty.pdf"))).rejects.toThrow();
  });
});

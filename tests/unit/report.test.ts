import { describe, expect, it } from "vitest";
import { buildLandlordLetter, buildReport } from "@/lib/report/build";
import { analyzeLease } from "@/lib/analysis/analyze";
import { SAMPLE_A, SAMPLE_B, sampleToDocument } from "@/lib/fixtures/sample-leases";

describe("report and landlord letter", () => {
  const a = analyzeLease(sampleToDocument(SAMPLE_A));
  it("builds questions from actual findings", () => {
    const report = buildReport(a, a.findings);
    expect(report.questions.some((q) => q.includes("$2,700") && q.includes("$1,800"))).toBe(true);
    expect(report.keyFindings.length).toBeGreaterThan(0);
    expect(report.overview.find((o) => o.label === "Upfront cash required")?.value).toBe("$6,725");
  });
  it("drafts an editable letter with placeholders and no personal data from the lease", () => {
    const letter = buildLandlordLetter(a.findings);
    expect(letter).toContain("[Landlord or property manager name]");
    expect(letter).toMatch(/1\. /);
    expect(letter).not.toContain("Jordan Example");
    expect(letter).not.toContain("Example Street");
  });
  it("produces a short letter for a clean lease", () => {
    const b = analyzeLease(sampleToDocument(SAMPLE_B));
    const letter = buildLandlordLetter(b.findings);
    expect(letter.split("\n").filter((l) => /^\d+\. /.test(l)).length).toBeLessThanOrEqual(3);
  });
});

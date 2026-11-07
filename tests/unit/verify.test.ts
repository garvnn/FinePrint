import { describe, expect, it } from "vitest";
import type { LegalSource, ResearchResponse, ResearchTopicId } from "@/types/lease";
import { applyResearch } from "@/lib/analysis/verify";
import { bundledResearch } from "@/lib/research/client";
import { analyzeText } from "../helpers/text-doc";

const lease = "Monthly rent is $1,800.00 per month. Tenant shall pay a security deposit of $2,700.00.";

function resp(topicId: ResearchTopicId, sources: Partial<LegalSource>[], status: ResearchResponse["status"] = "ok"): ResearchResponse {
  return {
    topicId,
    jurisdiction: "MA",
    status,
    provider: "tavily",
    query: "q",
    retrievedAt: "2026-11-07T12:00:00.000Z",
    cached: false,
    sources: sources.map((s) => ({
      title: "t",
      url: "https://malegislature.gov/Laws/x",
      excerpt: "",
      retrievedAt: "2026-11-07T12:00:00.000Z",
      topicId,
      sourceType: "statute",
      isOfficial: true,
      origin: "live",
      ...s,
    })),
  };
}

describe("research → findings (the $1,800 rent / $2,700 deposit example)", () => {
  const base = analyzeText(lease);
  const deposit = () => base.findings.find((f) => f.ruleId === "deposit-exceeds-rent")!;

  it("extracts, calculates and flags the conflict locally before research", () => {
    expect(deposit().financialImpact?.amount).toBe(900);
    expect(deposit().researchTopicIds).toEqual(["ma-security-deposit-limits"]);
    expect(deposit().verification.status).toBe("pending");
  });

  it("corroborates with an official live source and keeps high priority", () => {
    const out = applyResearch(base.findings, {
      "ma-security-deposit-limits": resp("ma-security-deposit-limits", [
        { excerpt: "(iii) a security deposit equal to the first month's rent provided that…", matchedPhrases: ["security deposit", "first month's rent"], corroborates: true },
      ]),
    });
    const f = out.find((x) => x.ruleId === "deposit-exceeds-rent")!;
    expect(f.verification.status).toBe("corroborated");
    expect(f.verification.origin).toBe("live");
    expect(f.priority).toBe("high");
    expect(f.verification.supportingSources[0].url).toContain("malegislature.gov");
  });

  it("downgrades and relabels when sources do not support the rule", () => {
    const out = applyResearch(base.findings, {
      "ma-security-deposit-limits": resp("ma-security-deposit-limits", [{ excerpt: "Unrelated page about parking.", corroborates: false, matchedPhrases: [] }]),
    });
    const f = out.find((x) => x.ruleId === "deposit-exceeds-rent")!;
    expect(f.verification.status).toBe("not_corroborated");
    expect(f.priority).toBe("medium");
    expect(f.kind).toBe("uncertain");
  });

  it("does not let a non-official source corroborate on its own (contradictory sources)", () => {
    const out = applyResearch(base.findings, {
      "ma-security-deposit-limits": resp("ma-security-deposit-limits", [
        { url: "https://blog.example/deposit", isOfficial: false, sourceType: "other", excerpt: "security deposit equal to the first month's rent is a myth", corroborates: true },
        { excerpt: "Landlords may charge any deposit.", corroborates: false },
      ]),
    });
    expect(out.find((x) => x.ruleId === "deposit-exceeds-rent")!.verification.status).toBe("not_corroborated");
  });

  it("marks verification unavailable when research failed and nothing is bundled", () => {
    const out = applyResearch(base.findings, {
      "ma-security-deposit-limits": { ...resp("ma-security-deposit-limits", [], "timeout"), message: "timed out" },
    });
    const f = out.find((x) => x.ruleId === "deposit-exceeds-rent")!;
    expect(f.verification.status).toBe("unavailable");
    expect(f.verification.note).toContain("timed out");
  });

  it("uses bundled references, labeled as bundled, never as live", () => {
    const out = applyResearch(base.findings, { "ma-security-deposit-limits": bundledResearch("ma-security-deposit-limits", "demo") });
    const f = out.find((x) => x.ruleId === "deposit-exceeds-rent")!;
    expect(f.verification.status).toBe("corroborated");
    expect(f.verification.origin).toBe("bundled");
    expect(f.verification.supportingSources.every((s) => s.origin === "bundled")).toBe(true);
    expect(f.verification.note).toMatch(/not a live search/);
  });

  it("leaves stated-fact findings untouched", () => {
    const out = applyResearch(base.findings, {});
    expect(out.find((x) => x.ruleId === "rent-stated")!.verification.status).toBe("not_applicable");
  });
});

describe("bundled references", () => {
  it("only cite malegislature.gov statute URLs", async () => {
    const { BUNDLED_SOURCES } = await import("@/lib/research/bundled");
    for (const list of Object.values(BUNDLED_SOURCES)) {
      for (const s of list) {
        expect(s.url).toMatch(/^https:\/\/malegislature\.gov\/Laws\/GeneralLaws\/PartII\/TitleI\/Chapter186\/Section\d+[A-Z]?$/);
        expect(s.origin).toBe("bundled");
      }
    }
  });
});

/**
 * "Before You Sign" report model and landlord inquiry draft. Pure functions.
 */
import type { AnalysisResult, LeaseFinding, LegalSource } from "@/types/lease";
import { formatUSD } from "@/lib/analysis/money";

export interface ReportModel {
  overview: { label: string; value: string }[];
  keyFindings: LeaseFinding[];
  otherFindings: LeaseFinding[];
  citations: LegalSource[];
  questions: string[];
  uncertainties: string[];
}

export function buildReport(analysis: AnalysisResult, findings: LeaseFinding[]): ReportModel {
  const f = analysis.financial;
  const overview = [
    { label: "Document", value: `${analysis.document.fileName} (${analysis.document.pageCount} page${analysis.document.pageCount === 1 ? "" : "s"})` },
    { label: "Jurisdiction", value: "Massachusetts (residential)" },
    { label: "Lease term", value: f.termMonths ? `${f.termMonths} months` : "Not detected" },
    { label: "Monthly rent", value: formatUSD(f.monthlyRent) },
    { label: "Upfront cash required", value: formatUSD(f.upfront.total) },
    { label: "Known first-year cost", value: formatUSD(f.firstYearKnownCost) },
    { label: "Analyzed", value: new Date(analysis.analyzedAt).toLocaleString("en-US") },
  ];
  const keyFindings = findings.filter((x) => x.priority === "high" || x.priority === "medium");
  const otherFindings = findings.filter((x) => x.priority === "low" || x.priority === "info");

  const seen = new Set<string>();
  const citations: LegalSource[] = [];
  for (const x of findings) {
    for (const s of x.verification.supportingSources.length ? x.verification.supportingSources : x.verification.consideredSources.filter((c) => c.isOfficial)) {
      const key = `${s.url}|${s.excerpt.slice(0, 40)}`;
      if (!seen.has(key)) {
        seen.add(key);
        citations.push(s);
      }
    }
  }

  const questions = [...new Set(findings.filter((x) => x.priority !== "info" || x.landlordQuestion).map((x) => x.landlordQuestion).filter((q): q is string => Boolean(q)))];

  const uncertainties = [
    ...f.unknowns,
    ...findings
      .filter((x) => x.verification.status === "not_corroborated" || x.verification.status === "unavailable")
      .map((x) => `"${x.title}": ${x.verification.note}`),
    ...findings.filter((x) => x.kind === "missing_information").map((x) => `${x.title}. ${x.explanation}`),
  ];

  return { overview, keyFindings, otherFindings, citations, questions, uncertainties };
}

/** Editable, plain-text inquiry to the landlord. Never sent automatically. */
export function buildLandlordLetter(findings: LeaseFinding[]): string {
  const asks = [...new Set(findings.filter((x) => x.priority !== "info").map((x) => x.landlordQuestion).filter((q): q is string => Boolean(q)))];
  const lines = [
    "Dear [Landlord or property manager name],",
    "",
    "Thank you for sending the lease for [property address]. Before I sign, I'd like to clarify a few points:",
    "",
    ...(asks.length ? asks.map((q, i) => `${i + 1}. ${q}`) : ["1. Could you confirm the total amount due at signing and what each payment covers?"]),
    "",
    "If any terms change, could you please send a revised copy of the lease? Written answers would be very helpful.",
    "",
    "Thank you,",
    "[Your name]",
    "[Phone / email]",
  ];
  return lines.join("\n");
}

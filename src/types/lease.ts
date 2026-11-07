/**
 * Core domain model for FinePrint.
 *
 * These types are UI-agnostic. Every React component consumes them, but none of
 * the analysis, cost or research logic depends on React. Swap the UI freely.
 */

/** A positioned run of text on a PDF page (PDF.js text item, normalized). */
export interface TextSpan {
  /** Character offset (inclusive) in LeasePage.text */
  start: number;
  /** Character offset (exclusive) in LeasePage.text */
  end: number;
  /** Bounding box in PDF user-space units at scale 1, origin top-left. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LeasePage {
  pageNumber: number;
  /** Page text. Line breaks are "\n"; offsets in TextSpan / Provenance refer to this string. */
  text: string;
  /** Positioned spans; may be empty for fixture pages that were not produced from a PDF. */
  spans: TextSpan[];
  width: number;
  height: number;
}

export type LeaseSource = "upload" | "sample" | "fixture";

export interface LeaseDocument {
  id: string;
  fileName: string;
  source: LeaseSource;
  pageCount: number;
  pages: LeasePage[];
  /** False when no page contained meaningful extractable text (e.g. a scanned PDF). */
  hasExtractableText: boolean;
}

/** A sentence-level segment of a page, used as the unit of evidence. */
export interface LeaseClause {
  id: string;
  pageNumber: number;
  start: number;
  end: number;
  text: string;
  /** Nearest preceding section heading on the same page, if detected. */
  heading?: string;
}

/** Where a fact came from in the original document. */
export interface Provenance {
  pageNumber: number;
  clauseId: string;
  /** The full clause (sentence) text. */
  excerpt: string;
  /** Offsets of the clause within the page text. */
  start: number;
  end: number;
  /** Optional narrower match (e.g. the dollar amount) within the page text. */
  matchStart?: number;
  matchEnd?: number;
}

export type FinancialTermKind =
  | "monthly_rent"
  | "first_month_rent"
  | "last_month_rent"
  | "security_deposit"
  | "one_time_fee"
  | "recurring_fee"
  | "late_fee"
  | "early_termination_fee"
  | "lease_term";

export type Frequency = "one_time" | "monthly" | "conditional" | "unknown";

/** How we know a value. */
export type TermStatus = "stated" | "ambiguous" | "user_corrected" | "derived";

export interface ExtractedFinancialTerm {
  id: string;
  kind: FinancialTermKind;
  label: string;
  /** Dollar amount, or months for lease_term; null when the clause exists but no amount is stated. */
  amount: number | null;
  frequency: Frequency;
  /** true = refundable, false = explicitly non-refundable, null = not stated. */
  refundable: boolean | null;
  /** Whether the lease says this is due at or before move-in. */
  dueAtSigning: boolean;
  status: TermStatus;
  /** Free text describing an amount expressed relative to rent ("two months' rent"). */
  relativeExpression?: string;
  /** Additional machine-readable detail (e.g. grace days for late fee). */
  detail?: Record<string, number | string | boolean>;
  provenance: Provenance | null;
}

export type FindingCategory =
  | "rent"
  | "deposit"
  | "upfront"
  | "fees"
  | "termination"
  | "maintenance"
  | "utilities"
  | "renewal"
  | "liability"
  | "general";

export type FindingPriority = "high" | "medium" | "low" | "info";

/**
 * What kind of statement a finding makes. These are deliberately distinct so
 * the UI never presents an extracted fact as a legal conclusion.
 */
export type FindingKind =
  | "stated_fact"
  | "calculated"
  | "potential_conflict"
  | "uncertain"
  | "missing_information";

export interface FinancialImpact {
  amount: number;
  label: string;
  formula: string;
}

export type VerificationStatus =
  | "not_applicable"
  | "pending"
  | "corroborated"
  | "not_corroborated"
  | "unavailable";

export interface FindingVerification {
  status: VerificationStatus;
  origin: ResearchOrigin | null;
  /** Sources whose text matched the rule's corroboration phrases. */
  supportingSources: LegalSource[];
  /** All sources considered for this finding's topics. */
  consideredSources: LegalSource[];
  matchedPhrases: string[];
  note: string;
}

export interface LeaseFinding {
  id: string;
  ruleId: string;
  category: FindingCategory;
  priority: FindingPriority;
  kind: FindingKind;
  title: string;
  explanation: string;
  evidence: Provenance[];
  financialImpact?: FinancialImpact;
  researchTopicIds: ResearchTopicId[];
  uncertainty: string;
  suggestedAction: string;
  landlordQuestion?: string;
  verification: FindingVerification;
}

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export type ResearchTopicId =
  | "ma-security-deposit-limits"
  | "ma-upfront-charges"
  | "ma-late-fees"
  | "ma-repair-obligations"
  | "ma-utilities-billing"
  | "ma-termination-notice"
  | "ma-lease-renewal"
  | "ma-landlord-liability-waiver"
  | "ma-attorney-fees";

export type Jurisdiction = "MA";

export interface ResearchTopic {
  id: ResearchTopicId;
  label: string;
  description: string;
}

export type SourceType = "statute" | "regulation" | "government_guidance" | "other";

/** live = retrieved by Tavily in this session; bundled = shipped with the app (not live). */
export type ResearchOrigin = "live" | "bundled";

export interface LegalSource {
  title: string;
  url: string;
  excerpt: string;
  /** ISO timestamp when the text was retrieved. */
  retrievedAt: string;
  topicId: ResearchTopicId;
  sourceType: SourceType;
  isOfficial: boolean;
  origin: ResearchOrigin;
  /**
   * Corroboration phrases found in the source's full text (computed
   * server-side for live results, from the excerpt for bundled ones).
   */
  matchedPhrases?: string[];
  /** True when the source text satisfied every corroboration group for its topic. */
  corroborates?: boolean;
}

export type ResearchStatus =
  | "ok"
  | "no_results"
  | "unconfigured"
  | "timeout"
  | "error"
  | "rate_limited";

export interface ResearchResponse {
  topicId: ResearchTopicId;
  jurisdiction: Jurisdiction;
  status: ResearchStatus;
  provider: "tavily";
  /** The exact generic query the server sent to the provider (no user content). */
  query: string | null;
  sources: LegalSource[];
  retrievedAt: string;
  cached: boolean;
  message?: string;
}

// ---------------------------------------------------------------------------
// Financial summary
// ---------------------------------------------------------------------------

export interface MoneyLine {
  label: string;
  amount: number;
  refundable: boolean | null;
  termId?: string;
}

export interface ConditionalCharge {
  label: string;
  amount: number | null;
  trigger: string;
  note: string;
  termId?: string;
}

export interface FormulaLine {
  label: string;
  formula: string;
  value: number | null;
}

export interface FinancialSummary {
  monthlyRent: number | null;
  termMonths: number | null;
  annualBaseRent: number | null;
  termBaseRent: number | null;
  upfront: {
    lines: MoneyLine[];
    total: number;
    refundable: number;
    nonRefundable: number;
    /** Prepaid rent (first/last month) – not refundable, but not an extra cost either. */
    prepaidRent: number;
  };
  recurringFees: MoneyLine[];
  recurringFeesAnnual: number;
  oneTimeNonRefundableFees: number;
  firstYearKnownCost: number | null;
  conditional: ConditionalCharge[];
  unknowns: string[];
  formulas: FormulaLine[];
}

export interface AnalysisResult {
  document: LeaseDocument;
  clauses: LeaseClause[];
  terms: ExtractedFinancialTerm[];
  financial: FinancialSummary;
  findings: LeaseFinding[];
  /** Distinct research topics referenced by findings. */
  researchTopics: ResearchTopicId[];
  analyzedAt: string;
}

/** User overrides for extracted values (Costs tab). Keyed by term kind. */
export interface FinancialOverrides {
  monthlyRent?: number | null;
  securityDeposit?: number | null;
  lastMonthRent?: number | null;
  termMonths?: number | null;
}

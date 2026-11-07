import type { FindingCategory, FindingKind, FindingPriority, SourceType, VerificationStatus } from "@/types/lease";

/** Display vocabulary. Change wording here without touching analysis logic. */
export const PRIORITY_LABEL: Record<FindingPriority, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
  info: "Info",
};

/** Short labels for the priority filter pills. */
export const PRIORITY_FILTER_LABEL: Record<FindingPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const PRIORITY_CLASS: Record<FindingPriority, { badge: string; soft: string; dot: string; border: string }> = {
  high: { badge: "bg-priority-high-soft text-priority-high", soft: "bg-priority-high-soft", dot: "bg-priority-high", border: "border-priority-high/30" },
  medium: { badge: "bg-priority-medium-soft text-priority-medium", soft: "bg-priority-medium-soft", dot: "bg-priority-medium", border: "border-priority-medium/30" },
  low: { badge: "bg-priority-low-soft text-priority-low", soft: "bg-priority-low-soft", dot: "bg-priority-low", border: "border-priority-low/25" },
  info: { badge: "bg-priority-info-soft text-priority-info", soft: "bg-priority-info-soft", dot: "bg-priority-info", border: "border-border" },
};

export const CATEGORY_LABEL: Record<FindingCategory, string> = {
  rent: "Rent",
  deposit: "Deposit",
  upfront: "Upfront costs",
  fees: "Fees",
  termination: "Early termination",
  maintenance: "Maintenance & repairs",
  utilities: "Utilities",
  renewal: "Renewal & notice",
  liability: "Liability",
  general: "General",
};

export const KIND_LABEL: Record<FindingKind, string> = {
  stated_fact: "Stated in lease",
  calculated: "Calculated",
  potential_conflict: "Potential legal conflict",
  uncertain: "Needs review",
  missing_information: "Missing information",
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  not_applicable: "No legal source needed",
  pending: "Checking Massachusetts law…",
  corroborated: "Supported by official source",
  not_corroborated: "Not confirmed by sources",
  unavailable: "Legal verification unavailable",
};

/** Short verification labels for badges ("Verification: Supported"). Null = no badge. */
export const VERIFICATION_SHORT_LABEL: Record<VerificationStatus, string | null> = {
  not_applicable: null,
  pending: "Checking…",
  corroborated: "Supported",
  not_corroborated: "Not confirmed",
  unavailable: "Unavailable",
};

export const VERIFICATION_CLASS: Record<VerificationStatus, string> = {
  not_applicable: "bg-priority-info-soft text-priority-info",
  pending: "bg-priority-low-soft text-priority-low",
  corroborated: "bg-success-soft text-success",
  not_corroborated: "bg-warning-soft text-warning",
  unavailable: "bg-priority-info-soft text-priority-info",
};

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  statute: "Statute",
  regulation: "Regulation",
  government_guidance: "Government guidance",
  other: "Other source",
};

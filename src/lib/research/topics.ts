import type { ResearchTopic, ResearchTopicId } from "@/types/lease";

/**
 * The research allowlist. This is the ONLY vocabulary the browser can use to
 * ask the server for legal research. Queries are constructed server-side from
 * these definitions; nothing from the lease document is ever included.
 */
export interface ResearchTopicDefinition extends ResearchTopic {
  /** Generic query the server sends to Tavily. Never contains user data. */
  query: string;
  /**
   * Corroboration check: a source supports a finding for this topic when its
   * text contains at least one phrase from EVERY group (case-insensitive).
   */
  corroboration: string[][];
  /** Keywords used to pick the most relevant excerpt from a long source. */
  excerptKeywords: string[];
}

export const RESEARCH_TOPICS: Record<ResearchTopicId, ResearchTopicDefinition> = {
  "ma-security-deposit-limits": {
    id: "ma-security-deposit-limits",
    label: "Security deposit limits",
    description: "Massachusetts limits on the amount of a residential security deposit.",
    query:
      "Massachusetts General Laws chapter 186 section 15B residential security deposit limit first month's rent",
    corroboration: [["security deposit"], ["first month's rent", "first month’s rent", "one month's rent", "1 month's rent"]],
    excerptKeywords: ["security deposit equal to the first month", "security deposit", "first month's rent"],
  },
  "ma-upfront-charges": {
    id: "ma-upfront-charges",
    label: "Permitted upfront charges",
    description: "What a Massachusetts landlord may require at or before the start of a tenancy.",
    query:
      "Massachusetts landlord may not require tenant to pay any amount in excess of first month last month security deposit lock and key chapter 186 15B",
    corroboration: [["in excess of", "no other", "only charge", "can only", "may only"], ["key and lock", "lock and key", "last month"]],
    excerptKeywords: ["any amount in excess of", "key and lock", "last full month", "rent for the first full month"],
  },
  "ma-late-fees": {
    id: "ma-late-fees",
    label: "Late fees and rent penalties",
    description: "When a Massachusetts lease may impose interest or penalties for late rent.",
    query: "Massachusetts residential lease late fee penalty for failure to pay rent thirty days chapter 186 section 15B",
    corroboration: [["interest or penalty", "late fee", "late charge", "penalty"], ["thirty days", "30 days"]],
    excerptKeywords: ["interest or penalty for failure to pay rent", "thirty days", "late fee"],
  },
  "ma-repair-obligations": {
    id: "ma-repair-obligations",
    label: "Repair and maintenance obligations",
    description: "Landlord duties to repair and maintain residential premises in Massachusetts.",
    query:
      "Massachusetts landlord obligation to make repairs state sanitary code 105 CMR 410 tenant lease waiver",
    corroboration: [["repair", "unsafe condition", "sanitary code"], ["landlord", "lessor", "owner"]],
    excerptKeywords: ["sanitary code", "unsafe condition", "repairs", "reasonable care to correct"],
  },
  "ma-utilities-billing": {
    id: "ma-utilities-billing",
    label: "Utility billing rules",
    description: "When Massachusetts tenants may be charged for heat, hot water, water and other utilities.",
    query:
      "Massachusetts tenant pay utilities heat hot water separately metered written lease water submetering chapter 186 section 22",
    corroboration: [["water", "heat", "utility", "utilities"], ["submeter", "metered", "consent", "written"]],
    excerptKeywords: ["submetering", "charge a tenant", "utility services", "separately metered"],
  },
  "ma-termination-notice": {
    id: "ma-termination-notice",
    label: "Termination and notice rules",
    description: "Notice periods and termination rules for Massachusetts residential tenancies.",
    query: "Massachusetts residential tenancy notice to terminate lease notice to quit chapter 186 section 12",
    corroboration: [["notice"], ["terminat", "determine", "quit"]],
    excerptKeywords: ["notice in writing", "notice to quit", "determined by either party"],
  },
  "ma-lease-renewal": {
    id: "ma-lease-renewal",
    label: "Automatic renewal clauses",
    description: "Massachusetts rules on residential lease automatic renewal or extension provisions.",
    query: "Massachusetts residential lease automatic renewal extension clause notice requirement landlord",
    corroboration: [["automatic", "automatically"], ["renew", "extension", "extend"]],
    excerptKeywords: ["automatic renewal", "automatically renew", "automatic extension"],
  },
  "ma-landlord-liability-waiver": {
    id: "ma-landlord-liability-waiver",
    label: "Landlord liability waivers",
    description: "Whether a Massachusetts lease can exempt a landlord from liability for negligence.",
    query:
      "Massachusetts lease provision hold landlord harmless exonerate liability negligence void chapter 186 section 15",
    corroboration: [["harmless", "exonerate", "liability"], ["void", "against public policy"]],
    excerptKeywords: ["hold the lessor or landlord harmless", "against public policy and void", "negligence"],
  },
  "ma-attorney-fees": {
    id: "ma-attorney-fees",
    label: "Attorney fee clauses",
    description: "Massachusetts treatment of one-sided attorney fee provisions in residential leases.",
    query: "Massachusetts residential lease landlord attorneys fees implied covenant tenant chapter 186 section 20",
    corroboration: [["attorneys' fees", "attorney's fees", "attorneys fees", "attorney fees"], ["tenant"]],
    excerptKeywords: ["implied in such lease a covenant", "attorneys' fees", "reasonable attorneys"],
  },
};

export const RESEARCH_TOPIC_IDS = Object.keys(RESEARCH_TOPICS) as ResearchTopicId[];

export const SUPPORTED_JURISDICTIONS = ["MA"] as const;

/** Domains preferred for official Massachusetts legal information. */
export const OFFICIAL_DOMAINS = ["malegislature.gov", "mass.gov"];

export function isResearchTopicId(value: unknown): value is ResearchTopicId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(RESEARCH_TOPICS, value);
}

export function getTopic(id: ResearchTopicId): ResearchTopicDefinition {
  return RESEARCH_TOPICS[id];
}

/**
 * Check a source text against a topic's corroboration groups. Pure; shared by
 * the server (full page text) and the browser (bundled excerpts).
 */
/** Lowercase and fold curly/variant apostrophes to "'" (same length, so offsets are preserved). */
export function foldText(s: string): string {
  return s.toLowerCase().replace(/[\u2018\u2019\u02bc\u0060\u00b4]/g, "'");
}

export function matchCorroboration(text: string, topicId: ResearchTopicId): { phrases: string[]; complete: boolean } {
  const lower = foldText(text).replace(/\s+/g, " ");
  const topic = RESEARCH_TOPICS[topicId];
  const phrases: string[] = [];
  let satisfied = 0;
  for (const group of topic.corroboration) {
    const hit = group.find((p) => lower.includes(foldText(p)));
    if (hit) {
      phrases.push(hit);
      satisfied++;
    }
  }
  return { phrases, complete: satisfied === topic.corroboration.length };
}

/**
 * Connects legal research to findings — deterministically.
 *
 * Retrieval (Tavily or bundled) is separate from conclusions. This module only
 * checks whether retrieved source text contains the phrases a rule depends on,
 * and adjusts the finding's verification status and priority accordingly:
 *
 *  corroborated      → an official source matched every phrase group; priority kept.
 *  not_corroborated  → sources were found but none clearly matched; priority is
 *                      lowered one level and the finding is relabeled "uncertain".
 *  unavailable       → research failed and no bundled reference exists.
 */
import type {
  FindingPriority,
  LeaseFinding,
  LegalSource,
  ResearchResponse,
  ResearchTopicId,
} from "@/types/lease";
import { matchCorroboration } from "@/lib/research/topics";

const DOWNGRADE: Record<FindingPriority, FindingPriority> = { high: "medium", medium: "low", low: "low", info: "info" };

export type ResearchMap = Partial<Record<ResearchTopicId, ResearchResponse>>;

function annotate(source: LegalSource): LegalSource {
  if (source.matchedPhrases && source.corroborates !== undefined) return source;
  const m = matchCorroboration(source.excerpt, source.topicId);
  return { ...source, matchedPhrases: m.phrases, corroborates: m.complete };
}

export function applyResearch(findings: LeaseFinding[], research: ResearchMap): LeaseFinding[] {
  return findings.map((f) => {
    if (f.researchTopicIds.length === 0 || f.verification.status === "not_applicable") return f;
    const responses = f.researchTopicIds.map((t) => research[t]).filter((r): r is ResearchResponse => Boolean(r));
    if (responses.length === 0) return f;

    const sources = responses.flatMap((r) => r.sources).map(annotate);
    const origin = sources.some((s) => s.origin === "live") ? "live" : sources.length ? "bundled" : null;

    if (sources.length === 0) {
      const messages = responses.map((r) => r.message).filter(Boolean).join(" ");
      return {
        ...f,
        verification: {
          status: "unavailable",
          origin: null,
          supportingSources: [],
          consideredSources: [],
          matchedPhrases: [],
          note: messages || "No legal sources were available for this topic.",
        },
      };
    }

    const supporting = sources.filter((s) => s.corroborates && s.isOfficial);
    const phrases = [...new Set(supporting.flatMap((s) => s.matchedPhrases ?? []))];
    const official = sources.filter((s) => s.isOfficial).length;

    if (supporting.length > 0) {
      const originLabel = origin === "live" ? "live search" : "bundled statute reference (not a live search)";
      return {
        ...f,
        verification: {
          status: "corroborated",
          origin,
          supportingSources: supporting,
          consideredSources: sources,
          matchedPhrases: phrases,
          note: `${supporting.length} of ${sources.length} source(s) from ${originLabel} contain the language this finding relies on${
            official < sources.length ? `; ${sources.length - official} non-official source(s) were also returned and ranked lower` : ""
          }.`,
        },
      };
    }

    return {
      ...f,
      priority: DOWNGRADE[f.priority],
      kind: f.kind === "potential_conflict" ? "uncertain" : f.kind,
      verification: {
        status: "not_corroborated",
        origin,
        supportingSources: [],
        consideredSources: sources,
        matchedPhrases: [],
        note: `${sources.length} source(s) were retrieved, but none from an official Massachusetts site clearly contained the language this finding relies on. Priority was lowered; treat this as unverified.`,
      },
    };
  });
}

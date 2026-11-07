/**
 * Browser-side research client. Every request goes through this function so
 * that the privacy guard runs and the audit log records it.
 */
import type { LeaseDocument, ResearchResponse, ResearchTopicId } from "@/types/lease";
import { checkOutgoingPayload } from "@/lib/privacy/guard";
import { recordAudit, updateAudit } from "@/lib/privacy/audit";
import { getBundledSources } from "./bundled";

export const RESEARCH_ENDPOINT = "/api/research";

export async function requestResearch(
  topicId: ResearchTopicId,
  doc: LeaseDocument | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ResearchResponse> {
  const payload = { topicId, jurisdiction: "MA" as const };
  const body = JSON.stringify(payload);
  const check = checkOutgoingPayload(payload, doc);
  const auditId = recordAudit({
    type: "network",
    endpoint: RESEARCH_ENDPOINT,
    body,
    bytes: new TextEncoder().encode(body).length,
    topicId,
    jurisdiction: "MA",
    forwardedTo: "Tavily Search API (api.tavily.com), via FinePrint server",
    leaseContentCheck: check.ok ? "passed" : "blocked",
    responseStatus: null,
    researchStatus: check.ok ? "pending" : "blocked",
  });
  const failure = (status: ResearchResponse["status"], message: string): ResearchResponse => ({
    topicId,
    jurisdiction: "MA",
    status,
    provider: "tavily",
    query: null,
    sources: [],
    retrievedAt: new Date().toISOString(),
    cached: false,
    message,
  });
  if (!check.ok) return failure("error", `Blocked by privacy guard: ${check.reason}`);

  try {
    const res = await fetchImpl(RESEARCH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.status === 429) {
      updateAudit(auditId, { responseStatus: 429, researchStatus: "rate_limited" });
      return failure("rate_limited", "Too many research requests. Try again in a minute.");
    }
    if (!res.ok) {
      updateAudit(auditId, { responseStatus: res.status, researchStatus: "error" });
      return failure("error", `Research request failed (HTTP ${res.status}).`);
    }
    const data = (await res.json()) as ResearchResponse;
    updateAudit(auditId, { responseStatus: res.status, researchStatus: data.status });
    return data;
  } catch {
    updateAudit(auditId, { responseStatus: null, researchStatus: "network_error" });
    return failure("error", "Network error while contacting the research service.");
  }
}

/** Demo / fallback: bundled reference material. Makes no network request. */
export function bundledResearch(topicId: ResearchTopicId, reason: string): ResearchResponse {
  const sources = getBundledSources(topicId);
  return {
    topicId,
    jurisdiction: "MA",
    status: sources.length ? "ok" : "no_results",
    provider: "tavily",
    query: null,
    sources,
    retrievedAt: sources[0]?.retrievedAt ?? new Date().toISOString(),
    cached: false,
    message: reason,
  };
}

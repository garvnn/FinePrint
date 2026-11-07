/**
 * SERVER-ONLY Tavily integration. Imported exclusively by app/api/research/route.ts.
 *
 * Input: an allowlisted topic ID. Output: structured, ranked legal sources.
 * No lease content ever reaches this module (the route rejects anything else).
 */
import type { LegalSource, ResearchResponse, ResearchTopicId, SourceType } from "@/types/lease";
import { foldText, getTopic, matchCorroboration, OFFICIAL_DOMAINS, type ResearchTopicDefinition } from "../topics";

const TAVILY_ENDPOINT = "https://api.tavily.com/search";
export const TAVILY_TIMEOUT_MS = 12_000;
const MAX_EXCERPT_CHARS = 700;
const MAX_SOURCES = 5;

interface TavilyResult {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  raw_content?: unknown;
  score?: unknown;
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isOfficialUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return OFFICIAL_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Bills on malegislature.gov are proposed legislation, not law. They often
 * quote the statute they would amend, so they match phrases. We exclude them so
 * a proposal is never cited as support for a finding.
 */
export function isProposedLegislation(url: string): boolean {
  const host = hostOf(url) ?? "";
  try {
    return host.endsWith("malegislature.gov") && new URL(url).pathname.toLowerCase().startsWith("/bills/");
  } catch {
    return false;
  }
}

const TYPE_RANK: Record<SourceType, number> = { statute: 30, regulation: 20, government_guidance: 10, other: 0 };

export function classifySource(url: string): SourceType {
  const host = hostOf(url) ?? "";
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (host.endsWith("malegislature.gov") && path.includes("/laws/")) return "statute";
  if (host.endsWith("mass.gov") && /mass-general-laws|general-laws/.test(path)) return "statute";
  if (host.endsWith("mass.gov") && (path.includes("/regulations/") || path.includes("cmr"))) return "regulation";
  if (host.endsWith("mass.gov") || host.endsWith("malegislature.gov")) return "government_guidance";
  return "other";
}

/**
 * Choose the most relevant window of text from a (possibly long) source body.
 * Picks the earliest occurrence of the highest-priority keyword and returns a
 * sentence-aligned window around it.
 */
export function extractRelevantExcerpt(text: string, keywords: string[], maxChars = MAX_EXCERPT_CHARS): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const lower = foldText(clean);
  let hit = -1;
  for (const kw of keywords) {
    const i = lower.indexOf(foldText(kw));
    if (i >= 0) {
      hit = i;
      break;
    }
  }
  if (hit < 0) return clean.slice(0, maxChars).trimEnd() + " …";
  let start = Math.max(0, hit - Math.floor(maxChars / 4));
  const sentenceStart = clean.lastIndexOf(". ", hit);
  if (sentenceStart >= start - 120 && sentenceStart >= 0 && sentenceStart < hit) start = sentenceStart + 2;
  const end = Math.min(clean.length, start + maxChars);
  return (start > 0 ? "… " : "") + clean.slice(start, end).trim() + (end < clean.length ? " …" : "");
}

/** Count corroboration groups satisfied by a text (0..groups.length). */
export function corroborationScore(text: string, topic: ResearchTopicDefinition): number {
  const lower = foldText(text);
  return topic.corroboration.filter((group) => group.some((p) => lower.includes(foldText(p)))).length;
}

/**
 * Convert raw Tavily results into ranked LegalSources. We do NOT trust result
 * order: official domains first (statutes > regulations > guidance), then by how
 * well the text matches the topic, then by Tavily's own score. Proposed bills
 * are dropped.
 */
export function normalizeTavilyResults(
  results: TavilyResult[],
  topicId: ResearchTopicId,
  retrievedAt: string,
): LegalSource[] {
  const topic = getTopic(topicId);
  const seen = new Set<string>();
  const scored: { source: LegalSource; rank: number }[] = [];
  for (const r of results) {
    if (typeof r.url !== "string" || !/^https:\/\//i.test(r.url)) continue;
    if (seen.has(r.url) || isProposedLegislation(r.url)) continue;
    seen.add(r.url);
    const title = typeof r.title === "string" && r.title.trim() ? r.title.trim() : r.url;
    const body =
      typeof r.raw_content === "string" && r.raw_content.length > 0
        ? r.raw_content
        : typeof r.content === "string"
          ? r.content
          : "";
    if (!body.trim()) continue;
    const excerpt = extractRelevantExcerpt(body, topic.excerptKeywords);
    const official = isOfficialUrl(r.url);
    const score = typeof r.score === "number" ? r.score : 0;
    const sourceType = classifySource(r.url);
    const rank = (official ? 100 : 0) + (official ? TYPE_RANK[sourceType] : 0) + corroborationScore(body, topic) * 10 + score;
    const match = matchCorroboration(body, topicId);
    scored.push({
      rank,
      source: {
        title: title.slice(0, 200),
        url: r.url,
        excerpt,
        retrievedAt,
        topicId,
        sourceType,
        isOfficial: official,
        origin: "live",
        matchedPhrases: match.phrases,
        corroborates: match.complete,
      },
    });
  }
  return scored
    .sort((a, b) => b.rank - a.rank)
    .slice(0, MAX_SOURCES)
    .map((s) => s.source);
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

async function tavilySearch(
  apiKey: string,
  query: string,
  includeDomains: string[] | undefined,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<TavilyResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query,
        search_depth: "advanced",
        max_results: 8,
        include_answer: false,
        include_raw_content: "text",
        ...(includeDomains ? { include_domains: includeDomains } : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new TavilyHttpError(res.status);
    const data = (await res.json()) as { results?: unknown };
    return Array.isArray(data.results) ? (data.results as TavilyResult[]) : [];
  } finally {
    clearTimeout(timer);
  }
}

export class TavilyHttpError extends Error {
  constructor(public status: number) {
    super(`Tavily responded with HTTP ${status}`);
  }
}

/**
 * Run research for one topic. Never throws; failures map to a status.
 * Strategy: search official MA domains first; if nothing usable comes back,
 * widen to the open web (results are marked non-official).
 */
export async function researchTopic(
  topicId: ResearchTopicId,
  opts: { apiKey: string | undefined; fetchImpl?: FetchLike; timeoutMs?: number; now?: () => Date },
): Promise<ResearchResponse> {
  const topic = getTopic(topicId);
  const now = opts.now ?? (() => new Date());
  const retrievedAt = now().toISOString();
  const base = { topicId, jurisdiction: "MA" as const, provider: "tavily" as const, retrievedAt, cached: false };

  if (!opts.apiKey) {
    return {
      ...base,
      status: "unconfigured",
      query: null,
      sources: [],
      message: "Live legal research is not configured on this server (TAVILY_API_KEY is not set).",
    };
  }
  const fetchImpl = opts.fetchImpl ?? ((i, init) => fetch(i, init));
  const timeoutMs = opts.timeoutMs ?? TAVILY_TIMEOUT_MS;
  try {
    let sources = normalizeTavilyResults(
      await tavilySearch(opts.apiKey, topic.query, OFFICIAL_DOMAINS, fetchImpl, timeoutMs),
      topicId,
      retrievedAt,
    );
    if (sources.length === 0) {
      sources = normalizeTavilyResults(
        await tavilySearch(opts.apiKey, topic.query, undefined, fetchImpl, timeoutMs),
        topicId,
        retrievedAt,
      );
    }
    if (sources.length === 0) {
      return { ...base, status: "no_results", query: topic.query, sources, message: "The search returned no usable sources." };
    }
    return { ...base, status: "ok", query: topic.query, sources };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ...base, status: "timeout", query: topic.query, sources: [], message: "The legal research provider timed out." };
    }
    const message =
      err instanceof TavilyHttpError
        ? `The legal research provider returned an error (HTTP ${err.status}).`
        : "Could not reach the legal research provider.";
    return { ...base, status: "error", query: topic.query, sources: [], message };
  }
}

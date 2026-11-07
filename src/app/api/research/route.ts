/**
 * POST /api/research — the ONLY server endpoint in FinePrint.
 *
 * Privacy boundary: accepts exactly { topicId, jurisdiction } where topicId is
 * from a fixed allowlist. Lease text, names, addresses and excerpts cannot be
 * expressed in this schema and are rejected. Request bodies are never logged.
 */
import { parseResearchRequest, MAX_RESEARCH_BODY_BYTES } from "@/lib/research/schema";
import { researchTopic } from "@/lib/research/server/tavily";
import { RateLimiter, TopicCache } from "@/lib/research/server/guards";

const limiter = new RateLimiter(40, 60_000);
const cache = new TopicCache(60 * 60 * 1000);

const NO_STORE = { "Cache-Control": "no-store" };

function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

export async function POST(request: Request): Promise<Response> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_RESEARCH_BODY_BYTES) {
    return Response.json({ error: "Request body too large." }, { status: 413, headers: NO_STORE });
  }

  if (!limiter.check(clientKey(request))) {
    return Response.json(
      { error: "Too many research requests. Please wait a minute." },
      { status: 429, headers: NO_STORE },
    );
  }

  const raw = await request.text();
  const parsed = parseResearchRequest(raw, request.headers.get("content-type"));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: parsed.status, headers: NO_STORE });
  }

  const { topicId } = parsed.value;
  const cached = cache.get(topicId);
  if (cached) return Response.json(cached, { headers: NO_STORE });

  const result = await researchTopic(topicId, { apiKey: process.env.TAVILY_API_KEY });
  cache.set(topicId, result);
  // Log only the generic topic and outcome — never request bodies or results.
  console.info(`[research] topic=${topicId} status=${result.status} sources=${result.sources.length}`);
  return Response.json(result, { headers: NO_STORE });
}

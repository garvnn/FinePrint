import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseResearchRequest } from "@/lib/research/schema";
import { RESEARCH_TOPICS } from "@/lib/research/topics";
import { normalizeTavilyResults, researchTopic, extractRelevantExcerpt, classifySource } from "@/lib/research/server/tavily";
import { RateLimiter } from "@/lib/research/server/guards";

let ip = 0;
async function freshRoute() {
  vi.resetModules();
  return (await import("@/app/api/research/route")).POST;
}
function req(body: unknown, headers: Record<string, string> = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://localhost/api/research", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ip % 250}`, ...headers },
    body: raw,
  });
}

const LEASE_TEXT = "Tenant shall pay a security deposit of $2,700.00 upon signing this Lease. Tenant: Jordan Example, 100 Example Street";

beforeEach(() => {
  delete process.env.TAVILY_API_KEY;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TAVILY_API_KEY;
});

describe("request validation (privacy boundary)", () => {
  it("accepts exactly an allowlisted topic and MA", () => {
    expect(parseResearchRequest(JSON.stringify({ topicId: "ma-late-fees", jurisdiction: "MA" }), "application/json").ok).toBe(true);
  });
  it("rejects raw lease text in any form", async () => {
    const POST = await freshRoute();
    for (const body of [
      { topicId: "ma-late-fees", jurisdiction: "MA", text: LEASE_TEXT },
      { topicId: LEASE_TEXT, jurisdiction: "MA" },
      { query: LEASE_TEXT },
      LEASE_TEXT,
    ]) {
      const res = await POST(req(body));
      expect([400, 413]).toContain(res.status);
    }
  });
  it("rejects unknown topics", async () => {
    const POST = await freshRoute();
    const res = await POST(req({ topicId: "ma-everything", jurisdiction: "MA" }));
    expect(res.status).toBe(400);
  });
  it("rejects unexpected fields, even small ones", async () => {
    const POST = await freshRoute();
    expect((await POST(req({ topicId: "ma-late-fees", jurisdiction: "MA", name: "Jo" }))).status).toBe(400);
    expect((await POST(req({ topicId: "ma-late-fees" }))).status).toBe(400);
    expect((await POST(req({ topicId: "ma-late-fees", jurisdiction: "NY" }))).status).toBe(400);
  });
  it("rejects oversized bodies, wrong content type and invalid JSON", async () => {
    const POST = await freshRoute();
    expect((await POST(req({ topicId: "ma-late-fees", jurisdiction: "MA", pad: "x".repeat(400) }))).status).toBe(413);
    expect((await POST(req({ topicId: "ma-late-fees", jurisdiction: "MA" }, { "content-type": "text/plain" }))).status).toBe(415);
    expect((await POST(req("{not json"))).status).toBe(400);
  });
  it("only exposes POST (no upload or GET endpoint)", async () => {
    vi.resetModules();
    const mod = await import("@/app/api/research/route");
    expect(Object.keys(mod).sort()).toEqual(["POST"]);
  });
});

describe("Tavily integration", () => {
  it("reports unconfigured when TAVILY_API_KEY is missing, without calling the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const POST = await freshRoute();
    const res = await POST(req({ topicId: "ma-security-deposit-limits", jurisdiction: "MA" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("unconfigured");
    expect(data.sources).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends only the server-built generic query to Tavily and ranks official sources first", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    const fetchSpy = vi.fn(async () =>
      Response.json({
        results: [
          { title: "Blog about deposits", url: "https://example-blog.com/deposits", content: "Some say any deposit is fine.", score: 0.99 },
          {
            title: "Section 15B",
            url: "https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section15B",
            content: "short",
            raw_content: "(b) ... (iii) a security deposit equal to the first month's rent provided that ...",
            score: 0.4,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const POST = await freshRoute();
    const data = await (await POST(req({ topicId: "ma-security-deposit-limits", jurisdiction: "MA" }))).json();
    expect(data.status).toBe("ok");
    expect(data.sources[0].url).toContain("malegislature.gov");
    expect(data.sources[0].isOfficial).toBe(true);
    expect(data.sources[0].corroborates).toBe(true);
    expect(data.sources[0].origin).toBe("live");
    expect(data.sources[0].retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(data.sources[1].isOfficial).toBe(false);
    const sent = JSON.parse((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.query).toBe(RESEARCH_TOPICS["ma-security-deposit-limits"].query);
    expect(sent.include_domains).toEqual(["malegislature.gov", "mass.gov"]);
    expect(JSON.stringify(sent)).not.toContain("2,700");
  });

  it("widens the search when official domains return nothing, and handles no results", async () => {
    const fetchSpy = vi.fn(async () => Response.json({ results: [] }));
    const r = await researchTopic("ma-late-fees", { apiKey: "k", fetchImpl: fetchSpy });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(r.status).toBe("no_results");
  });

  it("maps a timeout to status timeout", async () => {
    const slow = (_: string, init: RequestInit) =>
      new Promise<Response>((_res, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    const r = await researchTopic("ma-late-fees", { apiKey: "k", fetchImpl: slow, timeoutMs: 20 });
    expect(r.status).toBe("timeout");
  });

  it("maps HTTP errors and network failures to status error", async () => {
    const http = await researchTopic("ma-late-fees", { apiKey: "k", fetchImpl: async () => new Response("no", { status: 500 }) });
    expect(http.status).toBe("error");
    expect(http.message).toContain("500");
    const net = await researchTopic("ma-late-fees", { apiKey: "k", fetchImpl: async () => { throw new TypeError("fetch failed"); } });
    expect(net.status).toBe("error");
  });

  it("drops malformed results and non-https URLs", () => {
    const s = normalizeTavilyResults(
      [{ url: "http://insecure.example", content: "x" }, { title: "x" }, { url: "https://mass.gov/a", content: "" }, { url: "https://www.mass.gov/info-details/x", content: "late fee thirty days" }],
      "ma-late-fees",
      "2026-01-01T00:00:00.000Z",
    );
    expect(s.map((x) => x.url)).toEqual(["https://www.mass.gov/info-details/x"]);
    expect(s[0].sourceType).toBe("government_guidance");
  });

  it("classifies source types and extracts relevant excerpts", () => {
    expect(classifySource("https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section15B")).toBe("statute");
    expect(classifySource("https://www.mass.gov/regulations/105-CMR-410")).toBe("regulation");
    expect(classifySource("https://example.com")).toBe("other");
    const long = "intro ".repeat(300) + "No lease shall impose any interest or penalty for failure to pay rent until thirty days after due. " + "tail ".repeat(300);
    expect(extractRelevantExcerpt(long, ["interest or penalty for failure to pay rent"])).toContain("interest or penalty");
  });

  it("excludes proposed bills, ranks statutes above guidance, and folds curly apostrophes", () => {
    const s = normalizeTavilyResults(
      [
        { title: "Bill H.214", url: "https://malegislature.gov/Bills/191/H214/House/Bill/Text", content: "a security deposit equal to the first month's rent", score: 0.99 },
        { title: "Guide", url: "https://www.mass.gov/info-details/learn-about-paying-a-security-deposit", content: "security deposit equal to the first month’s rent", score: 0.9 },
        { title: "c.186 15B", url: "https://www.mass.gov/info-details/mass-general-laws-c186-ss-15b", content: "a security deposit equal to the first month’s rent", score: 0.1 },
      ],
      "ma-security-deposit-limits",
      "2026-01-01T00:00:00.000Z",
    );
    expect(s.map((x) => x.title)).toEqual(["c.186 15B", "Guide"]);
    expect(s[0].sourceType).toBe("statute");
    expect(s.every((x) => x.corroborates)).toBe(true);
  });

  it("dedupes case-variant URLs and drops search-result pages", () => {
    const body = "attorneys' fees … tenant";
    const s = normalizeTavilyResults(
      [
        { title: "s20", url: "https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section20", content: body },
        { title: "s20 dup", url: "https://malegislature.gov/Laws/GeneralLaws/Partii/Titlei/Chapter186/Section20", content: body },
        { title: "search", url: "https://malegislature.gov/Laws/Search?searchTerms=Landlord", content: body },
      ],
      "ma-attorney-fees",
      "2026-01-01T00:00:00.000Z",
    );
    expect(s.map((x) => x.title)).toEqual(["s20"]);
  });

  it("rate-limits per client", () => {
    const rl = new RateLimiter(2, 60_000);
    expect(rl.check("a", 0)).toBe(true);
    expect(rl.check("a", 1)).toBe(true);
    expect(rl.check("a", 2)).toBe(false);
    expect(rl.check("b", 2)).toBe(true);
    expect(rl.check("a", 70_000)).toBe(true);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkOutgoingPayload, containsDocumentText } from "@/lib/privacy/guard";
import { clearAudit, getAuditEvents, summarizeAudit } from "@/lib/privacy/audit";
import { requestResearch } from "@/lib/research/client";
import { textDoc } from "../helpers/text-doc";
import { ROOT } from "../helpers/node-pdf";

const doc = textDoc("Tenant Jordan Example shall pay a security deposit of $2,700.00 for 100 Example Street, Unit 3.");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("client-side pre-send guard", () => {
  it("passes a pure topic payload", () => {
    expect(checkOutgoingPayload({ topicId: "ma-late-fees", jurisdiction: "MA" }, doc)).toEqual({ ok: true });
  });
  it("blocks extra fields, unknown topics and other jurisdictions", () => {
    expect(checkOutgoingPayload({ topicId: "ma-late-fees", jurisdiction: "MA", excerpt: "x" }, doc).ok).toBe(false);
    expect(checkOutgoingPayload({ topicId: "anything", jurisdiction: "MA" }, doc).ok).toBe(false);
    expect(checkOutgoingPayload({ topicId: "ma-late-fees", jurisdiction: "CA" }, doc).ok).toBe(false);
  });
  it("detects lease text inside a value", () => {
    expect(containsDocumentText("security deposit of $2,700.00", doc)).toBe(true);
    expect(containsDocumentText("ma-security-deposit-limits", doc)).toBe(false);
  });
});

describe("research client", () => {
  beforeEach(() => clearAudit());

  it("sends only { topicId, jurisdiction } and records the exact body in the audit log", async () => {
    const fetchSpy = vi.fn(async () =>
      Response.json({ topicId: "ma-late-fees", jurisdiction: "MA", status: "unconfigured", provider: "tavily", query: null, sources: [], retrievedAt: "", cached: false }),
    );
    await requestResearch("ma-late-fees", doc, fetchSpy as unknown as typeof fetch);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/research");
    expect(JSON.parse(init.body as string)).toEqual({ topicId: "ma-late-fees", jurisdiction: "MA" });
    const events = getAuditEvents();
    expect(events).toHaveLength(1);
    const e = events[0];
    expect(e.type === "network" && e.body).toBe(init.body);
    expect(e.type === "network" && e.leaseContentCheck).toBe("passed");
    expect(e.type === "network" && e.researchStatus).toBe("unconfigured");
    const s = summarizeAudit(events);
    expect(s.topicIds).toEqual(["ma-late-fees"]);
  });

  it("does not call the network for a blocked payload", async () => {
    const fetchSpy = vi.fn();
    // Force a block by passing an invalid topic through the type system.
    const r = await requestResearch("not-a-topic" as never, doc, fetchSpy as unknown as typeof fetch);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(r.message).toMatch(/Blocked by privacy guard/);
    expect(summarizeAudit(getAuditEvents()).blockedRequests).toBe(1);
  });

  it("reports network failures without throwing", async () => {
    const r = await requestResearch("ma-late-fees", doc, (async () => { throw new TypeError("offline"); }) as unknown as typeof fetch);
    expect(r.status).toBe("error");
  });
});

describe("architecture invariants", () => {
  const app = join(ROOT, "src", "app");
  it("has exactly one server route handler: api/research", () => {
    const routes = walk(app).filter((p) => /route\.(t|j)sx?$/.test(p)).map((p) => relative(app, p));
    expect(routes).toEqual([join("api", "research", "route.ts")]);
  });
  it("browser code never calls third-party URLs or analytics", () => {
    const src = walk(join(ROOT, "src")).filter((p) => /\.(t|j)sx?$/.test(p) && !p.includes(join("research", "server")));
    for (const file of src) {
      const code = readFileSync(file, "utf8");
      expect(code, file).not.toMatch(/fetch\(\s*["'`]https?:\/\//);
      expect(code, file).not.toMatch(/googletagmanager|google-analytics|segment\.io|posthog|mixpanel|sentry/i);
    }
  });
  it("only the server module talks to Tavily", () => {
    const hits = walk(join(ROOT, "src")).filter((p) => readFileSync(p, "utf8").includes("api.tavily.com"));
    expect(hits.map((p) => relative(ROOT, p)).sort()).toEqual(
      [join("src", "lib", "research", "client.ts"), join("src", "lib", "research", "server", "tavily.ts")].sort(),
    );
    // client.ts only names Tavily in the human-readable audit label; it never fetches it.
    expect(readFileSync(join(ROOT, "src", "lib", "research", "client.ts"), "utf8")).not.toMatch(/fetchImpl\(\s*["'`]https/);
  });
  it("the server route does not log request bodies", () => {
    const code = readFileSync(join(app, "api", "research", "route.ts"), "utf8");
    expect(code).not.toMatch(/console\.\w+\([^)]*raw/);
    expect(code).not.toMatch(/console\.\w+\([^)]*body/);
  });
});

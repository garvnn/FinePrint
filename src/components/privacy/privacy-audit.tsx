"use client";

import { useMemo } from "react";
import { ArrowUpRight, Check, Cpu, Eye, Globe, Laptop, ShieldCheck, X } from "lucide-react";
import { useAuditEvents, useObservedRequests } from "@/hooks/use-audit";
import { summarizeAudit, type AuditEvent } from "@/lib/privacy/audit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type NetEvent = Extract<AuditEvent, { type: "network" }>;

export function PrivacyAudit() {
  const events = useAuditEvents();
  const summary = useMemo(() => summarizeAudit(events), [events]);
  const local = events.filter((e) => e.type === "local");
  const net = events.filter((e): e is NetEvent => e.type === "network");
  const observed = useObservedRequests();
  const pageOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const byOrigin = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of observed.requests) m.set(r.origin, (m.get(r.origin) ?? 0) + 1);
    return [...m.entries()];
  }, [observed.requests]);
  const thirdParty = byOrigin.filter(([o]) => o !== pageOrigin);
  const researchCalls = observed.requests.filter((r) => r.origin === pageOrigin && r.path === "/api/research").length;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Verdict
          ok
          title="Lease content transmitted"
          value="None"
          detail={`${summary.networkRequests} research request${summary.networkRequests === 1 ? "" : "s"} sent; each contained only a topic ID and "MA", checked before sending.`}
        />
        <Verdict ok title="Processed on this device" value={`${summary.localSteps} step${summary.localSteps === 1 ? "" : "s"}`} detail="Parsing, extraction, calculations and findings." />
        <Verdict
          ok={thirdParty.length === 0}
          title="Third-party requests from this page"
          value={observed.supported ? String(thirdParty.length) : "n/a"}
          detail={observed.supported ? "Observed via the browser's Resource Timing API since this page loaded." : "Resource Timing is not supported in this browser."}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Laptop className="size-4 text-success" /> Processed locally</CardTitle>
          <CardDescription>Recorded by the code that did the work, in this tab.</CardDescription>
        </CardHeader>
        <CardContent>
          {local.length === 0 ? (
            <p className="text-sm text-muted-foreground">No local processing recorded yet.</p>
          ) : (
            <ol className="space-y-2.5">
              {local.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <Cpu className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p>{e.detail}</p>
                    <p className="text-[0.7rem] text-muted-foreground">{new Date(e.at).toLocaleTimeString()}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ArrowUpRight className="size-4" /> Requests that left your browser</CardTitle>
          <CardDescription>
            Every legal research request, with the exact body sent. The FinePrint server forwards a query it builds itself (from
            the topic ID) to Tavily. Topic IDs submitted: {summary.topicIds.length ? summary.topicIds.join(", ") : "none yet"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {net.length === 0 ? (
            <p className="text-sm text-muted-foreground">No research requests have been sent. In demo mode, bundled references are used and nothing is sent.</p>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-2 py-2 font-medium">Time</th>
                    <th className="px-2 py-2 font-medium">Destination</th>
                    <th className="px-2 py-2 font-medium">Exact body sent</th>
                    <th className="px-2 py-2 font-medium">Size</th>
                    <th className="px-2 py-2 font-medium">Guard</th>
                    <th className="px-2 py-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {net.map((e) => (
                    <tr key={e.id} className="border-b align-top last:border-0">
                      <td className="px-2 py-2 whitespace-nowrap tabular-nums">{new Date(e.at).toLocaleTimeString()}</td>
                      <td className="px-2 py-2">
                        <span className="font-mono">POST {e.endpoint}</span>
                        <span className="block text-muted-foreground">
                          {e.researchStatus === "unconfigured"
                            ? "→ not forwarded (server has no Tavily key)"
                            : e.researchStatus === "blocked"
                              ? "→ never sent"
                              : `→ ${e.forwardedTo}`}
                        </span>
                      </td>
                      <td className="px-2 py-2"><code className="rounded bg-muted px-1.5 py-0.5 font-mono break-all">{e.body}</code></td>
                      <td className="px-2 py-2 tabular-nums">{e.bytes} B</td>
                      <td className="px-2 py-2">
                        <span className={cn("inline-flex items-center gap-1 font-medium", e.leaseContentCheck === "passed" ? "text-success" : "text-destructive")}>
                          {e.leaseContentCheck === "passed" ? <Check className="size-3" /> : <X className="size-3" />}
                          {e.leaseContentCheck === "passed" ? "No lease text" : "Blocked"}
                        </span>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {e.responseStatus ? `HTTP ${e.responseStatus}` : "—"}
                        {e.researchStatus && <span className="block text-muted-foreground">{e.researchStatus}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="size-4" /> All network activity observed on this page</CardTitle>
          <CardDescription>
            From the browser&apos;s Resource Timing API: app code, fonts, the PDF.js worker, sample files and research calls.
            This covers requests made by this page; it cannot see browser extensions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {byOrigin.map(([origin, count]) => (
            <div key={origin} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <Globe className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono text-xs">{origin}</span>
                {origin === pageOrigin && <span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.7rem] text-success">FinePrint (same origin)</span>}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{count} request{count === 1 ? "" : "s"}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Research API calls observed: {researchCalls}. Uploads of your PDF: none. There is no upload endpoint.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Guarantees and limits</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-2">
          <ul className="space-y-1.5">
            {[
              "The server's only endpoint accepts { topicId, jurisdiction } and rejects any other field, unknown topics and bodies over 256 bytes.",
              "A Content-Security-Policy restricts this page's network connections to its own origin (connect-src 'self').",
              "No analytics, trackers or third-party scripts.",
              "Nothing is stored: no cookies, no local storage of documents, no server database.",
            ].map((t) => (
              <li key={t} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-success" />{t}</li>
            ))}
          </ul>
          <ul className="space-y-1.5 text-muted-foreground">
            {[
              "Tavily receives FinePrint's generic queries and your server's IP, not yours. Their handling is governed by Tavily's policies.",
              "The hosting provider can see that you requested pages and research topics (standard web logs).",
              "Browser extensions you install can read any page; FinePrint cannot prevent that.",
            ].map((t) => (
              <li key={t} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />{t}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Verdict({ ok, title, value, detail }: { ok: boolean; title: string; value: string; detail: string }) {
  return (
    <div className={cn("rounded-xl border p-4", ok ? "border-success/30 bg-success-soft/50" : "border-warning/40 bg-warning-soft")}>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xl font-semibold">
        {ok ? <ShieldCheck className="size-5 text-success" /> : <Eye className="size-5 text-warning" />} {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

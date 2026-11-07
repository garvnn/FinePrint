"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useAuditEvents, useObservedRequests } from "@/hooks/use-audit";
import type { AuditEvent } from "@/lib/privacy/audit";
import { cn } from "@/lib/utils";
import { Panel } from "./bits";

type NetEvent = Extract<AuditEvent, { type: "network" }>;

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US");

function requestStatus(e: NetEvent): { text: string; className: string } {
  const http = e.responseStatus ? `${e.responseStatus} ` : "";
  switch (e.researchStatus) {
    case "pending":
      return { text: "Waiting for a response…", className: "text-priority-low" };
    case "ok":
      return { text: `${http}OK, source found`, className: "text-success" };
    case "no_results":
      return { text: `${http}OK, no source found`, className: "text-success" };
    case "unconfigured":
      return { text: `${http}not forwarded (server has no Tavily key), used bundled reference`, className: "text-warning" };
    case "blocked":
      return { text: "Blocked before sending", className: "text-destructive" };
    default:
      return { text: `${http}${e.researchStatus ?? "no response"}, used bundled reference`, className: "text-warning" };
  }
}

// window.location.origin, read without a hydration mismatch.
const noop = () => () => {};
function usePageOrigin(): string {
  return useSyncExternalStore(noop, () => window.location.origin, () => "");
}

export function PrivacyTab() {
  const events = useAuditEvents();
  const local = events.filter((e) => e.type === "local");
  const net = events.filter((e): e is NetEvent => e.type === "network");
  const observed = useObservedRequests();
  const origin = usePageOrigin();
  const { same, others } = useMemo(() => {
    const byOrigin = new Map<string, number>();
    for (const r of observed.requests) byOrigin.set(r.origin, (byOrigin.get(r.origin) ?? 0) + 1);
    return { same: byOrigin.get(origin) ?? 0, others: [...byOrigin.entries()].filter(([o]) => o !== origin) };
  }, [observed.requests, origin]);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Done on this device" titleId="done-locally">
        {local.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ol>
            {local.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-3.5 gap-y-0.5 border-t py-2 text-sm sm:flex-nowrap">
                <span className="shrink-0 font-mono text-muted-foreground sm:w-24">{time(e.at)}</span>
                <span className="min-w-0">{e.detail}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel
        title="Every request that left this page"
        titleId="requests"
        description="This is the exact body of each request. Your lease text, name and address are never in it."
      >
        {net.length === 0 ? (
          <p className="text-sm text-muted-foreground">No requests have left this page. With live search off, FinePrint uses bundled references and sends nothing.</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {net.map((e) => {
              const s = requestStatus(e);
              const passed = e.leaseContentCheck === "passed";
              return (
                <li key={e.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-semibold">
                      POST {e.endpoint} <span className="font-mono font-normal text-muted-foreground">{time(e.at)}</span>
                    </span>
                    <span className={cn("text-[0.8125rem] font-semibold", s.className)}>{s.text}</span>
                  </div>
                  <pre className="my-2 rounded-md bg-foreground p-2.5 font-mono text-[0.8125rem] break-words whitespace-pre-wrap text-background">
                    {e.body}
                  </pre>
                  <p className={cn("text-sm font-semibold", passed ? "text-success" : "text-destructive")}>
                    Privacy guard: {passed ? "passed, no lease text, names or addresses" : "blocked, this request was never sent"}
                  </p>
                  <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                    {e.bytes} bytes. {passed && e.researchStatus !== "unconfigured" ? `Forwarded as a topic search to ${e.forwardedTo}.` : ""}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>

      <Panel title="Network activity by origin" titleId="origins">
        {!observed.supported ? (
          <p className="text-sm text-muted-foreground">This browser doesn’t report network activity to the page, so it can’t be listed here.</p>
        ) : (
          <ul>
            <li className="flex justify-between gap-3 border-t py-2">
              <span>This app (same origin)</span>
              <span className="font-semibold tabular-nums">
                {same} request{same === 1 ? "" : "s"}
              </span>
            </li>
            {others.length === 0 ? (
              <li className="flex justify-between gap-3 border-t py-2">
                <span>Any other site</span>
                <span className="font-semibold text-success tabular-nums">0 requests</span>
              </li>
            ) : (
              others.map(([o, n]) => (
                <li key={o} className="flex justify-between gap-3 border-t py-2">
                  <span className="min-w-0 font-mono text-sm break-all">{o}</span>
                  <span className="font-semibold text-warning tabular-nums">
                    {n} request{n === 1 ? "" : "s"}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </Panel>

      <div className="rounded-lg bg-priority-info-soft px-4 py-3.5 text-sm text-foreground/80">
        <p className="mb-1 font-semibold">What this can’t check</p>
        <p>
          FinePrint sees requests made by this page. Browser extensions, your network and your operating system are outside what it can
          check. The app’s server passes only the topic to Tavily.
        </p>
      </div>
    </div>
  );
}

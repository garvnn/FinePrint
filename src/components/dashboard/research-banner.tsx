"use client";

import { RefreshCw } from "lucide-react";
import type { ResearchTopicId } from "@/types/lease";
import type { LeaseSession } from "@/hooks/use-lease-session";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Tone = "live" | "loading" | "fallback" | "off";

const TONE: Record<Tone, string> = {
  live: "border-success/30 bg-success-soft text-success",
  loading: "border-priority-low/30 bg-accent text-priority-low",
  fallback: "border-warning/30 bg-warning-soft text-warning",
  off: "border-priority-info/20 bg-priority-info-soft text-foreground/80",
};

const BUNDLED = "Showing bundled references, not live.";

function describe(session: LeaseSession, topics: ResearchTopicId[], demo: boolean): { tone: Tone; title: string; text: string } {
  if (session.researchMode === "bundled") {
    return demo
      ? { tone: "off", title: "Demo mode.", text: `Live search is off for this preview. ${BUNDLED}` }
      : { tone: "off", title: "Live search is off.", text: BUNDLED };
  }
  if (topics.length === 0) {
    return { tone: "live", title: "Live sources.", text: "Live search is on. No finding needed a Massachusetts law source." };
  }
  const entries = topics.map((t) => session.research[t]);
  const done = entries.filter((e) => e?.status === "done");
  if (done.length < topics.length) {
    return {
      tone: "loading",
      title: "Checking sources.",
      text: `${done.length} of ${topics.length} topics done. Findings update as sources arrive.`,
    };
  }
  const fellBack = done.filter((e) => e?.usedFallback);
  if (fellBack.length) {
    const reason = fellBack.find((e) => e?.live?.message)?.live?.message;
    const scope = fellBack.length === topics.length ? "" : ` ${fellBack.length} of ${topics.length} topics fell back.`;
    return { tone: "fallback", title: "Live verification unavailable.", text: `${reason ? `${reason} ` : ""}${BUNDLED}${scope}` };
  }
  const latest = done
    .map((e) => e?.live?.retrievedAt)
    .filter((x): x is string => Boolean(x))
    .sort()
    .at(-1);
  const when = latest ? `, ${new Date(latest).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : "";
  return { tone: "live", title: "Live sources.", text: `Massachusetts law retrieved with Tavily${when}.` };
}

export function ResearchBanner({
  session,
  topics,
  demo,
  onModeChange,
}: {
  session: LeaseSession;
  topics: ResearchTopicId[];
  /** True while the page is in the demo mode it was opened with (?research=bundled). */
  demo: boolean;
  onModeChange: (live: boolean) => void;
}) {
  const { tone, title, text } = describe(session, topics, demo);
  const live = session.researchMode === "live";
  return (
    <div
      data-print-hide
      role="status"
      className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-lg border px-3.5 py-2.5 text-sm", TONE[tone])}
    >
      <span className="font-semibold">{title}</span>
      <span className="min-w-0">{text}</span>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        {tone === "fallback" && (
          <Button
            variant="outline"
            onClick={session.retryResearch}
            className="h-9 border-warning/60 bg-card px-3.5 font-semibold text-warning hover:bg-card/80 hover:text-warning"
          >
            <RefreshCw data-icon="inline-start" aria-hidden="true" />
            Retry live search
          </Button>
        )}
        <div className="flex min-h-9 items-center gap-2.5">
          <Switch id="live-search" checked={live} onCheckedChange={onModeChange} />
          <Label htmlFor="live-search" className="cursor-pointer text-sm font-semibold text-foreground">
            Live search
          </Label>
        </div>
      </div>
    </div>
  );
}

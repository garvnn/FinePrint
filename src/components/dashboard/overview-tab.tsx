"use client";

import type { LeaseFinding, ResearchTopicId } from "@/types/lease";
import type { ResearchMode, TopicResearch } from "@/hooks/use-lease-session";
import { getTopic } from "@/lib/research/topics";
import { Disclaimer, Panel, PriorityPill } from "./bits";
import { pageLabel } from "./finding-card";

interface Props {
  findings: LeaseFinding[];
  topics: ResearchTopicId[];
  research: Partial<Record<ResearchTopicId, TopicResearch>>;
  researchMode: ResearchMode;
  onOpenFinding: (id: string) => void;
}

function topicState(r: TopicResearch | undefined, mode: ResearchMode): { text: string; className: string } {
  if (!r || r.status === "loading") return { text: "Checking…", className: "text-priority-low" };
  const found = (r.effective?.sources.length ?? 0) > 0;
  if (!found) return { text: "No source found", className: "text-priority-info" };
  if (!r.usedFallback) return { text: "Live source found", className: "text-success" };
  return mode === "bundled"
    ? { text: "Bundled reference, not live", className: "text-warning" }
    : { text: "Fallback: bundled reference, not live", className: "text-warning" };
}

export function OverviewTab({ findings, topics, research, researchMode, onOpenFinding }: Props) {
  const high = findings.filter((f) => f.priority === "high");

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Look at these first"
        titleId="look-first"
        description={
          high.length
            ? `${high.length} high-priority finding${high.length === 1 ? "" : "s"} to review before you sign.`
            : "No high-priority findings. Check the Findings tab for anything else worth asking about."
        }
      >
        {high.length > 0 && (
          <ul className="flex flex-col gap-2">
            {high.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onOpenFinding(f.id)}
                  className="flex min-h-13 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <PriorityPill priority={f.priority} />
                  <span className="min-w-0 flex-1 font-semibold">{f.title}</span>
                  <span className="text-sm text-muted-foreground">{pageLabel(f)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Research status" titleId="research-status">
        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No finding needed a Massachusetts law source.</p>
        ) : (
          <ul>
            {topics.map((t) => {
              const s = topicState(research[t], researchMode);
              return (
                <li key={t} className="flex flex-wrap items-center justify-between gap-2 border-t py-2.5">
                  <span>{getTopic(t).label}</span>
                  <span className={`text-[0.8125rem] font-semibold ${s.className}`}>{s.text}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Disclaimer />
    </div>
  );
}

"use client";

import { ArrowRight, CheckCircle2, CircleDashed, Loader2, TriangleAlert } from "lucide-react";
import type { FindingCategory, LeaseFinding, ResearchTopicId } from "@/types/lease";
import type { TopicResearch } from "@/hooks/use-lease-session";
import { RESEARCH_TOPICS } from "@/lib/research/topics";
import { PRIORITY_ORDER } from "@/lib/analysis/rules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PriorityBadge, VerificationBadge } from "@/components/findings/badges";
import { CATEGORY_LABEL, PRIORITY_CLASS } from "@/components/findings/labels";

interface Props {
  findings: LeaseFinding[];
  research: Partial<Record<ResearchTopicId, TopicResearch>>;
  topics: ResearchTopicId[];
  onOpenFinding: (id: string) => void;
  onOpenCategory: (c: FindingCategory) => void;
  onOpenTab: (tab: string) => void;
}

const COVERAGE = ["Monthly rent & schedule", "Security deposit", "First & last month's rent", "Additional fees", "Early termination", "Maintenance & repairs", "Utilities", "Renewal & notice"];

export function OverviewPanel({ findings, research, topics, onOpenFinding, onOpenCategory, onOpenTab }: Props) {
  const top = findings.filter((f) => f.priority === "high" || f.priority === "medium").slice(0, 4);
  const byCategory = new Map<FindingCategory, LeaseFinding[]>();
  for (const f of findings) byCategory.set(f.category, [...(byCategory.get(f.category) ?? []), f]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Most important</CardTitle>
          <CardDescription>Highest-priority findings. Select one to see the clause on the page.</CardDescription>
        </CardHeader>
        <CardContent>
          {top.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" /> No high- or medium-priority findings in the provisions FinePrint checks.</p>
          ) : (
            <ul className="divide-y">
              {top.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => onOpenFinding(f.id)} className="group flex w-full items-start gap-3 py-3 text-left">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", PRIORITY_CLASS[f.priority].dot)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium group-hover:text-primary">{f.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2">
                        <PriorityBadge priority={f.priority} />
                        {f.evidence[0] && <span className="text-xs text-muted-foreground">Page {f.evidence[0].pageNumber}</span>}
                        <VerificationBadge verification={f.verification} compact />
                      </span>
                    </span>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="outline" className="mt-2" onClick={() => onOpenTab("findings")}>See all {findings.length} findings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Findings by category</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {[...byCategory.entries()].map(([cat, list]) => {
            const worst = [...list].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])[0];
            return (
              <button key={cat} type="button" onClick={() => onOpenCategory(cat)} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm hover:bg-muted/60">
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", PRIORITY_CLASS[worst.priority].dot)} />
                  {CATEGORY_LABEL[cat]}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{list.length}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Massachusetts legal research</CardTitle>
          <CardDescription>One generic query per topic. No lease content is sent.</CardDescription>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No findings required legal research.</p>
          ) : (
            <ul className="space-y-2">
              {topics.map((t) => {
                const r = research[t];
                const eff = r?.effective;
                return (
                  <li key={t} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{RESEARCH_TOPICS[t].label}</span>
                      <code className="ml-2 font-mono text-[0.7rem] text-muted-foreground">{t}</code>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs">
                      {!r || r.status === "loading" ? (
                        <><Loader2 className="size-3.5 animate-spin" /> Searching…</>
                      ) : !r.usedFallback ? (
                        <><CheckCircle2 className="size-3.5 text-success" /> {eff?.sources.length} live source{eff?.sources.length === 1 ? "" : "s"}{eff?.cached ? " (cached)" : ""}</>
                      ) : eff && eff.sources.length ? (
                        <><CircleDashed className="size-3.5 text-warning" /> Bundled reference ({eff.sources.length})</>
                      ) : (
                        <><TriangleAlert className="size-3.5 text-warning" /> No source available</>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Button variant="link" className="mt-1 px-0" onClick={() => onOpenTab("privacy")}>See exactly what was sent →</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What FinePrint checks</CardTitle>
          <CardDescription>A deterministic rule engine, not a comprehensive legal review. Provisions it doesn&apos;t recognize are not interpreted.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {COVERAGE.map((c) => (
              <li key={c} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-muted-foreground" />{c}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { FindingCategory, FindingPriority, LeaseDocument, LeaseFinding } from "@/types/lease";
import { cn } from "@/lib/utils";
import { FindingCard } from "./finding-card";
import { CATEGORY_LABEL, PRIORITY_CLASS, PRIORITY_LABEL } from "./labels";

export type PriorityFilter = FindingPriority | "all";

interface Props {
  findings: LeaseFinding[];
  document: LeaseDocument;
  selectedId: string | null;
  activeEvidence: number | null;
  onSelect: (id: string | null) => void;
  onShowEvidence: (findingId: string, index: number) => void;
  priority: PriorityFilter;
  onPriorityChange: (p: PriorityFilter) => void;
  category: FindingCategory | "all";
  onCategoryChange: (c: FindingCategory | "all") => void;
}

const PRIORITIES: FindingPriority[] = ["high", "medium", "low", "info"];

export function FindingsList(props: Props) {
  const { findings, priority, category } = props;
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: findings.length };
    for (const f of findings) c[f.priority] = (c[f.priority] ?? 0) + 1;
    return c;
  }, [findings]);
  const categories = useMemo(() => [...new Set(findings.map((f) => f.category))], [findings]);
  const visible = findings.filter((f) => (priority === "all" || f.priority === priority) && (category === "all" || f.category === category));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by priority">
        {(["all", ...PRIORITIES] as PriorityFilter[]).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={priority === p}
            onClick={() => props.onPriorityChange(p)}
            disabled={p !== "all" && !counts[p]}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-40",
              priority === p ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
            )}
          >
            {p !== "all" && <span className={cn("size-1.5 rounded-full", PRIORITY_CLASS[p].dot)} />}
            {p === "all" ? "All" : PRIORITY_LABEL[p].replace(" priority", "")}
            <span className="tabular-nums opacity-70">{counts[p] ?? 0}</span>
          </button>
        ))}
        {categories.length > 1 && (
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => props.onCategoryChange(e.target.value as FindingCategory | "all")}
            className="h-8 rounded-full border bg-card px-3 text-xs"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
            ))}
          </select>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No findings match this filter.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              document={props.document}
              expanded={props.selectedId === f.id}
              activeEvidence={props.selectedId === f.id ? props.activeEvidence : null}
              onToggle={() => props.onSelect(props.selectedId === f.id ? null : f.id)}
              onShowEvidence={(i) => props.onShowEvidence(f.id, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

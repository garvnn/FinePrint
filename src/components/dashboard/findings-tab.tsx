"use client";

import type { FindingCategory, FindingPriority, LeaseDocument, LeaseFinding } from "@/types/lease";
import { CATEGORY_LABEL, PRIORITY_FILTER_LABEL } from "@/components/findings/labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Disclaimer } from "./bits";
import { FindingCard } from "./finding-card";

export type PriorityFilter = FindingPriority | "all";
export type CategoryFilter = FindingCategory | "all";

const PRIORITIES: PriorityFilter[] = ["all", "high", "medium", "low", "info"];

interface Props {
  findings: LeaseFinding[];
  document: LeaseDocument;
  priority: PriorityFilter;
  category: CategoryFilter;
  onPriorityChange: (p: PriorityFilter) => void;
  onCategoryChange: (c: CategoryFilter) => void;
  expandedId: string | null;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onShowEvidence: (id: string, index: number) => void;
}

export function FindingsTab(props: Props) {
  const { findings, priority, category } = props;
  const categories = [...new Set(findings.map((f) => f.category))];
  const visible = findings.filter((f) => (priority === "all" || f.priority === priority) && (category === "all" || f.category === category));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card px-4 py-3.5">
        <div>
          <p id="priority-filter-label" className="mb-1.5 text-[0.8125rem] font-semibold text-muted-foreground">
            Priority
          </p>
          <div role="group" aria-labelledby="priority-filter-label" className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => {
              const on = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => props.onPriorityChange(p)}
                  className={cn(
                    "min-h-10 rounded-full border px-3.5 text-[0.8125rem] font-semibold transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {p === "all" ? "All" : PRIORITY_FILTER_LABEL[p]}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label htmlFor="category-filter" className="mb-1.5 block text-[0.8125rem] font-semibold text-muted-foreground">
            Category
          </label>
          <select
            id="category-filter"
            value={category}
            onChange={(e) => props.onCategoryChange(e.target.value as CategoryFilter)}
            className="min-h-10 rounded-md border bg-card px-3 text-sm"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Disclaimer boxed />

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-input bg-card p-6 text-center">
          <p className="mb-2.5">{findings.length ? "No findings match these filters." : "FinePrint found nothing to flag in the clauses it checks."}</p>
          {findings.length > 0 && (
            <Button
              variant="outline"
              className="h-10 border-primary bg-card px-3.5 font-semibold text-primary hover:text-primary"
              onClick={() => {
                props.onPriorityChange("all");
                props.onCategoryChange("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        visible.map((f) => (
          <FindingCard
            key={f.id}
            finding={f}
            document={props.document}
            expanded={props.expandedId === f.id}
            selected={props.selectedId === f.id}
            onToggle={() => props.onToggle(f.id)}
            onShowEvidence={(i) => props.onShowEvidence(f.id, i)}
          />
        ))
      )}
    </div>
  );
}

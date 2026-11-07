"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { AnalysisResult, FinancialOverrides, FinancialSummary, MoneyLine } from "@/types/lease";
import { formatUSD } from "@/lib/analysis/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, Pill } from "./bits";
import { earlyTerminationCharge } from "./summary-strip";

function RefundPill({ refundable }: { refundable: boolean | null }) {
  if (refundable === true) return <Pill className="bg-success-soft text-success">Refundable</Pill>;
  if (refundable === false) return <Pill className="bg-muted text-foreground/80">Non-refundable</Pill>;
  return <Pill className="bg-priority-info-soft text-priority-info">Not stated</Pill>;
}

export function CostsTab({
  analysis,
  overrides,
  onOverridesChange,
}: {
  analysis: AnalysisResult;
  overrides: FinancialOverrides;
  onOverridesChange: (o: FinancialOverrides) => void;
}) {
  const f = analysis.financial;
  const firstYear = f.formulas.find((x) => x.label === "Known first-year contractual cost");
  const etf = earlyTerminationCharge(analysis);
  const etfFormula = f.formulas.find((x) => x.label === "Early termination fee");

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Due at signing" titleId="due-at-signing">
        {f.upfront.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No amounts due at signing were found in the lease.</p>
        ) : (
          <>
            <ul>
              {f.upfront.lines.map((l: MoneyLine, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-2.5">
                  <span className="flex-[1_1_160px]">{l.label}</span>
                  <RefundPill refundable={l.refundable} />
                  <span className="min-w-20 text-right font-semibold tabular-nums">{formatUSD(l.amount)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between gap-3 border-t-2 border-foreground pt-3 font-bold">
              <span>Total due at signing</span>
              <span className="tabular-nums">{formatUSD(f.upfront.total)}</span>
            </div>
            {f.upfront.refundable > 0 && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Includes the {formatUSD(f.upfront.refundable)} refundable deposit, which isn’t counted as a cost.
              </p>
            )}
          </>
        )}
      </Panel>

      <Panel title="First-year cost" titleId="first-year" description={null}>
        <p className="-mt-2 text-[1.75rem] font-semibold tabular-nums">{formatUSD(f.firstYearKnownCost)}</p>
        {firstYear && <p className="mt-1 font-mono text-[0.8125rem] break-words text-muted-foreground">{firstYear.formula}</p>}
        <p className="mt-1.5 text-sm text-muted-foreground">Doesn’t include the refundable deposit or the conditional charges below.</p>
      </Panel>

      <Panel title="Conditional charges" titleId="conditional">
        {f.conditional.length === 0 ? (
          <p className="text-sm text-muted-foreground">No conditional charges were found in the lease.</p>
        ) : (
          <ul>
            {f.conditional.map((c, i) => {
              const isEtf = c === etf;
              return (
                <li key={i} className="border-t py-2.5">
                  <div className="flex flex-wrap justify-between gap-2 font-semibold">
                    <span>{c.label}</span>
                    <span className="tabular-nums">{c.amount !== null ? formatUSD(c.amount) : "Not stated"}</span>
                  </div>
                  <p className="mt-0.5 text-sm">Applies if: {c.trigger}</p>
                  {isEtf && <p className="mt-0.5 text-sm font-medium">Conditional, and may not be the full cost.</p>}
                  <p className="mt-0.5 text-sm text-muted-foreground">{c.note}</p>
                  {isEtf && etfFormula && <p className="mt-0.5 font-mono text-[0.8125rem] text-muted-foreground">{etfFormula.formula}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Not stated in the lease" titleId="not-stated">
        {f.unknowns.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing FinePrint checks for was left unstated.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5">
            {f.unknowns.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Remount when the applied overrides change so the inputs show the recalculated values. */}
      <CorrectNumbers key={JSON.stringify(overrides)} financial={f} overrides={overrides} onChange={onOverridesChange} />
    </div>
  );
}

const FIELDS: { key: keyof FinancialOverrides; label: string; step: string; get: (f: FinancialSummary) => number | null }[] = [
  { key: "monthlyRent", label: "Monthly rent ($)", step: "0.01", get: (f) => f.monthlyRent },
  { key: "securityDeposit", label: "Security deposit ($)", step: "0.01", get: (f) => f.upfront.lines.find((l) => l.label === "Security deposit")?.amount ?? null },
  { key: "lastMonthRent", label: "Last month’s rent ($)", step: "0.01", get: (f) => f.upfront.lines.find((l) => l.label.startsWith("Last month"))?.amount ?? null },
  { key: "termMonths", label: "Term (months)", step: "1", get: (f) => f.termMonths },
];

function CorrectNumbers({
  financial,
  overrides,
  onChange,
}: {
  financial: FinancialSummary;
  overrides: FinancialOverrides;
  onChange: (o: FinancialOverrides) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((x) => [x.key, x.get(financial)?.toString() ?? ""])),
  );

  // Same rules as before the refresh: blank or invalid fields are ignored; only changed values become overrides.
  const apply = () => {
    const next: FinancialOverrides = {};
    for (const field of FIELDS) {
      const raw = draft[field.key]?.trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) continue;
      if (n !== field.get(financial) || overrides[field.key] !== undefined) next[field.key] = n;
    }
    onChange(next);
  };

  return (
    <Panel title="Correct a number" titleId="correct" description="If we read something wrong, fix it here, then recalculate.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-3">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <Label htmlFor={`ov-${field.key}`} className="mb-1 text-[0.8125rem] font-semibold">
                {field.label}
              </Label>
              <Input
                id={`ov-${field.key}`}
                type="number"
                inputMode="decimal"
                min="0"
                step={field.step}
                placeholder="Not found"
                value={draft[field.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                className="h-10 border-input bg-card"
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" className="h-10 px-4 font-semibold">
            Recalculate
          </Button>
          {Object.keys(overrides).length > 0 && (
            <Button type="button" variant="outline" className="h-10 bg-card px-4" onClick={() => onChange({})}>
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
              Reset to values from the lease
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}

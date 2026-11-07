"use client";

import { useState } from "react";
import { Calculator, CircleHelp, Pencil, RotateCcw } from "lucide-react";
import type { FinancialOverrides, FinancialSummary } from "@/types/lease";
import { formatUSD } from "@/lib/analysis/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function RefundTag({ refundable }: { refundable: boolean | null }) {
  if (refundable === true) return <span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.7rem] font-medium text-success">Refundable</span>;
  if (refundable === false) return <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">Non-refundable</span>;
  return <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[0.7rem] font-medium text-warning">Refundability not stated</span>;
}

export function CostBreakdown({
  financial: f,
  overrides,
  onOverridesChange,
}: {
  financial: FinancialSummary;
  overrides: FinancialOverrides;
  onOverridesChange: (o: FinancialOverrides) => void;
}) {
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Due at or before move-in</CardTitle>
          <CardDescription>Amounts the lease requires up front, separated by whether you get them back.</CardDescription>
        </CardHeader>
        <CardContent>
          {f.upfront.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upfront amounts were identified.</p>
          ) : (
            <ul className="divide-y">
              {f.upfront.lines.map((l, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span className="flex items-center gap-2">{l.label} <RefundTag refundable={l.refundable} /></span>
                  <span className="font-medium tabular-nums">{formatUSD(l.amount)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between py-3 font-semibold">
                <span>Total due up front</span>
                <span className="tabular-nums">{formatUSD(f.upfront.total)}</span>
              </li>
            </ul>
          )}
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <MiniStat label="Prepaid rent" value={formatUSD(f.upfront.prepaidRent)} hint="Rent paid early, not an extra cost" />
            <MiniStat label="Refundable" value={formatUSD(f.upfront.refundable)} hint="Returned at move-out, subject to deductions" />
            <MiniStat label="Non-refundable fees" value={formatUSD(f.upfront.nonRefundable)} hint="Gone once paid" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>First year</CardTitle>
            <CardDescription>Known contractual charges for the first 12 months of occupancy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Base rent" value={f.monthlyRent !== null ? formatUSD(f.monthlyRent * Math.min(12, f.termMonths ?? 12)) : "—"} />
            {f.recurringFees.map((r, i) => (
              <Row key={i} label={`${r.label} (${formatUSD(r.amount)}/mo)`} value={formatUSD(r.amount * Math.min(12, f.termMonths ?? 12))} />
            ))}
            <Row label="One-time non-refundable fees" value={formatUSD(f.oneTimeNonRefundableFees)} />
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Known first-year cost</span>
              <span className="tabular-nums">{formatUSD(f.firstYearKnownCost)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Excludes the refundable deposit, utilities and anything conditional.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conditional charges</CardTitle>
            <CardDescription>Only owed if something happens. Not included in totals.</CardDescription>
          </CardHeader>
          <CardContent>
            {f.conditional.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conditional charges were identified.</p>
            ) : (
              <ul className="space-y-3">
                {f.conditional.map((c, i) => (
                  <li key={i} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2 font-medium">
                      <span>{c.label}</span>
                      <span className="tabular-nums">{c.amount !== null ? formatUSD(c.amount) : "Not stated"}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">When: {c.trigger}</p>
                    <p className="mt-1 text-xs">{c.note}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="size-4" /> Formulas and assumptions</CardTitle>
          <CardDescription>Every number above is computed deterministically from values in the lease.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {f.formulas.map((x, i) => (
              <li key={i} className="grid gap-1 sm:grid-cols-[12rem_1fr_auto] sm:items-baseline sm:gap-4">
                <span className="font-medium">{x.label}</span>
                <span className="font-mono text-xs break-words text-muted-foreground">{x.formula}</span>
                <span className="font-semibold tabular-nums">{formatUSD(x.value)}</span>
              </li>
            ))}
          </ul>
          {f.unknowns.length > 0 && (
            <div className="mt-5 rounded-lg bg-warning-soft p-3">
              <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"><CircleHelp className="size-3.5" /> Unknown or unspecified</h4>
              <ul className="list-disc space-y-1 pl-5 text-xs">
                {f.unknowns.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <OverridesForm key={JSON.stringify(overrides)} financial={f} overrides={overrides} onChange={onOverridesChange} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg bg-muted/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
      <p className="text-[0.7rem] text-muted-foreground">{hint}</p>
    </div>
  );
}

const FIELDS: { key: keyof FinancialOverrides; label: string; get: (f: FinancialSummary) => number | null; step: string }[] = [
  { key: "monthlyRent", label: "Monthly rent ($)", get: (f) => f.monthlyRent, step: "0.01" },
  { key: "securityDeposit", label: "Security deposit ($)", get: (f) => f.upfront.lines.find((l) => l.label === "Security deposit")?.amount ?? null, step: "0.01" },
  { key: "lastMonthRent", label: "Last month's rent ($)", get: (f) => f.upfront.lines.find((l) => l.label.startsWith("Last month"))?.amount ?? null, step: "0.01" },
  { key: "termMonths", label: "Lease term (months)", get: (f) => f.termMonths, step: "1" },
];

function OverridesForm({ financial, overrides, onChange }: { financial: FinancialSummary; overrides: FinancialOverrides; onChange: (o: FinancialOverrides) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((x) => [x.key, x.get(financial)?.toString() ?? ""])),
  );
  const hasOverrides = Object.keys(overrides).length > 0;

  const apply = () => {
    const next: FinancialOverrides = {};
    for (const field of FIELDS) {
      const raw = draft[field.key]?.trim();
      const current = field.get(financial);
      if (raw === "" || raw === undefined) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) continue;
      if (n !== current || overrides[field.key] !== undefined) next[field.key] = n;
    }
    onChange(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Pencil className="size-4" /> Correct extracted values</CardTitle>
        <CardDescription>
          If FinePrint misread a number, fix it here. Findings and totals recalculate locally and are marked as corrected.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`ov-${field.key}`}>{field.label}</Label>
              <Input
                id={`ov-${field.key}`}
                inputMode="decimal"
                type="number"
                min="0"
                step={field.step}
                value={draft[field.key] ?? ""}
                placeholder="Not found"
                onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit">Recalculate</Button>
            {hasOverrides && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onChange({})}
              >
                <RotateCcw data-icon="inline-start" /> Reset to extracted values
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

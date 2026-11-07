import type { FinancialSummary, LeaseFinding } from "@/types/lease";
import { formatUSD } from "@/lib/analysis/money";
import { cn } from "@/lib/utils";

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "alert" }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3 shadow-card">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 truncate text-xl font-semibold tabular-nums", tone === "alert" && "text-priority-high")}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function SummaryStrip({ financial: f, findings }: { financial: FinancialSummary; findings: LeaseFinding[] }) {
  const etf = f.conditional.find((c) => c.label.toLowerCase().includes("early termination"));
  const high = findings.filter((x) => x.priority === "high").length;
  const review = findings.filter((x) => x.priority !== "info").length;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Stat label="Monthly rent" value={formatUSD(f.monthlyRent)} sub={f.termMonths ? `${f.termMonths}-month term` : "Term not detected"} />
      <Stat label="Annual base rent" value={formatUSD(f.annualBaseRent)} sub="Monthly rent × 12" />
      <Stat label="Due at signing" value={formatUSD(f.upfront.total)} sub={`${formatUSD(f.upfront.refundable)} refundable deposit`} />
      <Stat
        label="Early termination"
        value={etf ? (etf.amount !== null ? formatUSD(etf.amount) : "See lease") : "Not stated"}
        sub={etf ? "Conditional; may not be the full cost" : "No fee or option found"}
      />
      <Stat label="Findings to review" value={String(review)} sub={high ? `${high} high priority` : "No high-priority items"} tone={high ? "alert" : undefined} />
    </div>
  );
}

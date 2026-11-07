import type { AnalysisResult, ConditionalCharge, LeaseFinding } from "@/types/lease";
import { formatUSD } from "@/lib/analysis/money";
import { cn } from "@/lib/utils";

/** The early termination charge, identified by the kind of the lease term it came from. */
export function earlyTerminationCharge(analysis: AnalysisResult): ConditionalCharge | undefined {
  return analysis.financial.conditional.find(
    (c) => analysis.terms.find((t) => t.id === c.termId)?.kind === "early_termination_fee",
  );
}

function Stat({ label, value, sub, mono, alert }: { label: string; value: string; sub: string; mono?: boolean; alert?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-card px-4 py-3">
      <p className="text-[0.8125rem] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[1.375rem] font-semibold tabular-nums">{value}</p>
      <p
        className={cn(
          "mt-0.5 text-[0.8125rem]",
          mono && "font-mono break-words",
          alert ? "font-semibold text-priority-high" : "text-muted-foreground",
        )}
      >
        {sub}
      </p>
    </div>
  );
}

export function SummaryStrip({ analysis, findings }: { analysis: AnalysisResult; findings: LeaseFinding[] }) {
  const f = analysis.financial;
  const etf = earlyTerminationCharge(analysis);
  const annual = f.formulas.find((x) => x.label === "Annual base rent");
  const high = findings.filter((x) => x.priority === "high").length;

  return (
    <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-3">
      <Stat label="Monthly rent" value={formatUSD(f.monthlyRent)} sub={f.monthlyRent !== null ? "Stated in lease" : "Not found in lease"} />
      <Stat label="Annual base rent" value={formatUSD(f.annualBaseRent)} sub={annual?.formula ?? "Monthly rent × 12"} mono />
      <Stat
        label="Due at signing"
        value={formatUSD(f.upfront.total)}
        sub={f.upfront.refundable ? `Includes ${formatUSD(f.upfront.refundable)} refundable deposit` : "No refundable deposit found"}
      />
      <Stat
        label="Early termination"
        value={etf ? (etf.amount !== null ? formatUSD(etf.amount) : "See lease") : "Not stated"}
        sub={etf ? "Conditional, may not be the full cost" : "No early termination fee found"}
      />
      <Stat
        label="Findings to review"
        value={String(findings.length)}
        sub={high ? `${high} high priority` : "None high priority"}
        alert={high > 0}
      />
    </section>
  );
}

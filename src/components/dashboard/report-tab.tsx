"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import type { AnalysisResult, LeaseFinding, LegalSource } from "@/types/lease";
import { buildReport } from "@/lib/report/build";
import { formatUSD } from "@/lib/analysis/money";
import { summarizeAudit } from "@/lib/privacy/audit";
import { useAuditEvents } from "@/hooks/use-audit";
import { PRIORITY_LABEL } from "@/components/findings/labels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DISCLAIMER } from "./bits";
import { pageLabel } from "./finding-card";
import { earlyTerminationCharge } from "./summary-strip";

interface Props {
  analysis: AnalysisResult;
  findings: LeaseFinding[];
  letter: string;
  onLetterChange: (text: string) => void;
}

function citation(f: LeaseFinding): string {
  const v = f.verification;
  const src: LegalSource | undefined = v.supportingSources[0] ?? v.consideredSources.find((s) => s.isOfficial);
  if (src) return `Source: ${src.title} (${src.origin === "live" ? "live" : "bundled reference, not live"}).`;
  return v.status === "not_applicable" ? "" : v.note;
}

export function ReportTab({ analysis, findings, letter, onLetterChange }: Props) {
  const report = useMemo(() => buildReport(analysis, findings), [analysis, findings]);
  const audit = summarizeAudit(useAuditEvents());
  const f = analysis.financial;
  const etf = earlyTerminationCharge(analysis);
  const doc = analysis.document;
  const all = [...report.keyFindings, ...report.otherFindings];
  const high = findings.filter((x) => x.priority === "high").length;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
    } catch {
      /* clipboard unavailable: the text can still be selected by hand */
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div data-print-hide className="flex flex-wrap gap-2.5">
        <Button onClick={() => window.print()} className="h-11 px-4 font-semibold">
          <Printer data-icon="inline-start" aria-hidden="true" />
          Print / Save as PDF
        </Button>
      </div>

      <article data-print-area className="rounded-lg border bg-card p-6">
        <h2 className="mb-1 text-[1.375rem] font-bold">Before You Sign: Lease Report</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {doc.fileName}. Massachusetts residential lease, {doc.pageCount} page{doc.pageCount === 1 ? "" : "s"}. Generated on this device.
        </p>

        <h3 className="mb-1.5 font-semibold">Overview</h3>
        <p className="mb-2">
          {findings.length} finding{findings.length === 1 ? "" : "s"} to review, {high} of them high priority.
        </p>
        <dl className="mb-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {report.overview.map((o) => (
            <div key={o.label} className="flex justify-between gap-3 border-b border-dashed py-1">
              <dt className="text-muted-foreground">{o.label}</dt>
              <dd className="text-right font-medium">{o.value}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mb-1.5 font-semibold">Money</h3>
        <p className="mb-4">
          Rent {formatUSD(f.monthlyRent)} a month ({formatUSD(f.annualBaseRent)} a year). Due at signing {formatUSD(f.upfront.total)}
          {f.upfront.refundable ? `, including a ${formatUSD(f.upfront.refundable)} refundable deposit` : ""}. First-year cost{" "}
          {formatUSD(f.firstYearKnownCost)}, not counting the refundable deposit.
          {etf ? ` Early termination ${etf.amount !== null ? formatUSD(etf.amount) : "amount not stated"}, conditional and may not be the full cost.` : ""}
        </p>

        <h3 className="mb-1.5 font-semibold">Findings</h3>
        {all.length === 0 ? (
          <p className="mb-4">No findings in the clauses FinePrint checks.</p>
        ) : (
          <ol className="mb-4 list-decimal pl-5">
            {all.map((x) => (
              <li key={x.id} className="mb-2 break-inside-avoid">
                <strong>{x.title}</strong> ({PRIORITY_LABEL[x.priority]}, {pageLabel(x).toLowerCase()}). {citation(x)}
              </li>
            ))}
          </ol>
        )}

        {report.uncertainties.length > 0 && (
          <>
            <h3 className="mb-1.5 font-semibold">Still uncertain</h3>
            <ul className="mb-4 list-disc pl-5">
              {report.uncertainties.map((u, i) => (
                <li key={i} className="mb-1">
                  {u}
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="mb-1.5 font-semibold">Privacy</h3>
        <p className="mb-4">
          The lease was read and analyzed in this browser. It was not uploaded or stored.{" "}
          {audit.networkRequests === 0
            ? "No research requests left the page."
            : `${audit.networkRequests} topic-only research request${audit.networkRequests === 1 ? "" : "s"} left the page, with no lease text, names or addresses.`}
        </p>

        <p className="rounded-md bg-priority-info-soft px-3.5 py-2.5 text-[0.8125rem] text-foreground/80">{DISCLAIMER}</p>
      </article>

      <section data-print-hide aria-labelledby="letter-heading" className="rounded-lg border bg-card px-5 py-[1.125rem]">
        <h2 id="letter-heading" className="mb-1 text-lg font-bold">
          Letter to your landlord
        </h2>
        <p className="mb-2.5 text-sm text-muted-foreground">Edit it, then copy it into your own email. Nothing is ever sent from FinePrint.</p>
        <Textarea
          aria-label="Landlord message draft"
          value={letter}
          onChange={(e) => {
            onLetterChange(e.target.value);
            setCopied(false);
          }}
          rows={15}
          className="border-input bg-card text-sm leading-relaxed"
        />
        <Button
          variant="outline"
          onClick={copy}
          className="mt-2.5 h-11 border-primary bg-card px-4 font-semibold text-primary hover:text-primary"
        >
          {copied ? <Check data-icon="inline-start" aria-hidden="true" /> : <Copy data-icon="inline-start" aria-hidden="true" />}
          <span aria-live="polite">{copied ? "Copied" : "Copy letter"}</span>
        </Button>
      </section>
    </div>
  );
}

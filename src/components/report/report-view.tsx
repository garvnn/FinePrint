"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Printer } from "lucide-react";
import type { AnalysisResult, LeaseFinding } from "@/types/lease";
import { buildLandlordLetter, buildReport } from "@/lib/report/build";
import { formatUSD } from "@/lib/analysis/money";
import { summarizeAudit } from "@/lib/privacy/audit";
import { useAuditEvents } from "@/hooks/use-audit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PriorityBadge } from "@/components/findings/badges";
import { CATEGORY_LABEL, KIND_LABEL, VERIFICATION_LABEL } from "@/components/findings/labels";
import { LogoMark } from "@/components/layout/logo";

export function ReportView({ analysis, findings }: { analysis: AnalysisResult; findings: LeaseFinding[] }) {
  const report = useMemo(() => buildReport(analysis, findings), [analysis, findings]);
  const [letter, setLetter] = useState(() => buildLandlordLetter(findings));
  const [copied, setCopied] = useState(false);
  const audit = summarizeAudit(useAuditEvents());
  const f = analysis.financial;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="space-y-6">
      <div data-print-hide className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">Print or save this report as a PDF. Use your browser&apos;s &ldquo;Save as PDF&rdquo; destination.</p>
        <Button onClick={() => window.print()}>
          <Printer data-icon="inline-start" /> Print / Save as PDF
        </Button>
      </div>

      <article data-print-area className="space-y-8 rounded-xl border bg-card p-6 shadow-card sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold"><LogoMark className="size-5" /> FinePrint</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Before You Sign: Lease Report</h2>
            <p className="text-sm text-muted-foreground">Massachusetts residential lease · Generated {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}</p>
          </div>
          <p className="max-w-xs text-xs text-muted-foreground">General information, not legal advice. Flagged clauses are not necessarily illegal or unenforceable.</p>
        </header>

        <section>
          <h3 className="mb-3 text-lg font-semibold">Lease overview</h3>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {report.overview.map((o) => (
              <div key={o.label} className="flex justify-between gap-3 border-b border-dashed py-1">
                <dt className="text-muted-foreground">{o.label}</dt>
                <dd className="text-right font-medium">{o.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold">Financial summary</h3>
          <table className="w-full text-sm">
            <tbody>
              {f.upfront.lines.map((l, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1.5">{l.label}{l.refundable === true ? " (refundable)" : ""}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatUSD(l.amount)}</td>
                </tr>
              ))}
              <tr className="border-b font-semibold"><td className="py-1.5">Total due up front</td><td className="py-1.5 text-right tabular-nums">{formatUSD(f.upfront.total)}</td></tr>
              <tr className="border-b"><td className="py-1.5">Annual base rent</td><td className="py-1.5 text-right tabular-nums">{formatUSD(f.annualBaseRent)}</td></tr>
              {f.recurringFees.length > 0 && <tr className="border-b"><td className="py-1.5">Recurring fees (first year)</td><td className="py-1.5 text-right tabular-nums">{formatUSD(f.recurringFeesAnnual)}</td></tr>}
              <tr className="border-b font-semibold"><td className="py-1.5">Known first-year cost (excl. refundable deposit)</td><td className="py-1.5 text-right tabular-nums">{formatUSD(f.firstYearKnownCost)}</td></tr>
              {f.conditional.map((c, i) => (
                <tr key={`c${i}`} className="border-b text-muted-foreground"><td className="py-1.5">Conditional: {c.label} ({c.trigger.toLowerCase()})</td><td className="py-1.5 text-right tabular-nums">{c.amount !== null ? formatUSD(c.amount) : "Not stated"}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold">Findings to review ({report.keyFindings.length})</h3>
          {report.keyFindings.length === 0 ? (
            <p className="text-sm text-muted-foreground">No high- or medium-priority findings.</p>
          ) : (
            <ol className="space-y-4">
              {report.keyFindings.map((x) => <ReportFinding key={x.id} f={x} />)}
            </ol>
          )}
          {report.otherFindings.length > 0 && (
            <>
              <h4 className="mt-6 mb-2 font-semibold">Other notes</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {report.otherFindings.map((x) => (
                  <li key={x.id}>{x.title}{x.evidence[0] ? ` (page ${x.evidence[0].pageNumber})` : ""}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold">Supporting citations</h3>
          {report.citations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No legal sources were retrieved.</p>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {report.citations.map((c, i) => (
                <li key={i}>
                  <span className="font-medium">{c.title}</span>. <span className="break-all text-muted-foreground">{c.url}</span>.{" "}
                  {c.origin === "live" ? `Retrieved via live search ${new Date(c.retrievedAt).toLocaleString("en-US")}.` : `Bundled reference captured ${new Date(c.retrievedAt).toLocaleDateString("en-US")} (not a live search).`}
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold">Questions for the landlord</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {report.questions.map((q, i) => <li key={i}>{q}</li>)}
          </ol>
        </section>

        {report.uncertainties.length > 0 && (
          <section>
            <h3 className="mb-3 text-lg font-semibold">Unresolved uncertainties</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {report.uncertainties.map((u, i) => <li key={i}>{u}</li>)}
            </ul>
          </section>
        )}

        <section className="rounded-lg bg-muted/60 p-4 text-sm">
          <h3 className="mb-1 font-semibold">Privacy statement</h3>
          <p className="text-muted-foreground">
            This lease was parsed and analyzed entirely in the reader&apos;s web browser. The document was not uploaded or stored.
            {` ${audit.networkRequests}`} legal research request{audit.networkRequests === 1 ? " was" : "s were"} sent, each containing only a
            generic topic ID and the jurisdiction &ldquo;MA&rdquo;{audit.topicIds.length ? ` (${audit.topicIds.join(", ")})` : ""}. No lease text, names
            or addresses were transmitted.
          </p>
        </section>
      </article>

      <section data-print-hide className="space-y-3 rounded-xl border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Draft message to your landlord</h3>
            <p className="text-sm text-muted-foreground">Built from your findings. Edit freely. FinePrint never sends anything.</p>
          </div>
          <Button variant="outline" onClick={copy}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Copied" : "Copy text"}
          </Button>
        </div>
        <Textarea aria-label="Landlord message draft" value={letter} onChange={(e) => setLetter(e.target.value)} rows={16} className="font-mono text-sm leading-relaxed" />
      </section>
    </div>
  );
}

function ReportFinding({ f }: { f: LeaseFinding }) {
  const src = f.verification.supportingSources[0];
  return (
    <li className="break-inside-avoid rounded-lg border p-4 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={f.priority} />
        <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[f.category]} · {KIND_LABEL[f.kind]}</span>
      </div>
      <p className="font-semibold">{f.title}</p>
      <p className="mt-1">{f.explanation}</p>
      {f.evidence[0] && (
        <blockquote className="mt-2 border-l-2 pl-3 text-muted-foreground">
          Page {f.evidence[0].pageNumber}: &ldquo;{f.evidence[0].excerpt}&rdquo;
        </blockquote>
      )}
      {f.financialImpact && <p className="mt-2">Impact: <span className="font-medium tabular-nums">{formatUSD(f.financialImpact.amount)}</span> ({f.financialImpact.label}; {f.financialImpact.formula})</p>}
      {f.verification.status !== "not_applicable" && (
        <p className="mt-2 text-xs text-muted-foreground">
          Legal check: {VERIFICATION_LABEL[f.verification.status]}{src ? ` (${src.title}, ${src.origin === "live" ? "live" : "bundled reference"})` : ""}.
        </p>
      )}
      <p className="mt-2 text-xs"><span className="font-medium">Uncertainty:</span> {f.uncertainty}</p>
      <p className="mt-1 text-xs"><span className="font-medium">Suggested action:</span> {f.suggestedAction}</p>
    </li>
  );
}

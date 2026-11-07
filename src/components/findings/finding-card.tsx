"use client";

import { ChevronDown, ExternalLink, FileText, HelpCircle, Lightbulb, MessageSquareQuote, Scale, TriangleAlert } from "lucide-react";
import type { LeaseDocument, LeaseFinding, LegalSource, Provenance } from "@/types/lease";
import { formatUSD } from "@/lib/analysis/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OriginTag, PriorityBadge, VerificationBadge } from "./badges";
import { CATEGORY_LABEL, KIND_LABEL, PRIORITY_CLASS, SOURCE_TYPE_LABEL } from "./labels";

interface Props {
  finding: LeaseFinding;
  document: LeaseDocument;
  expanded: boolean;
  activeEvidence: number | null;
  onToggle: () => void;
  onShowEvidence: (index: number) => void;
}

function markIn(text: string, needle: string | null) {
  if (!needle) return text;
  const i = text.indexOf(needle);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-highlight px-0.5 text-foreground">{needle}</mark>
      {text.slice(i + needle.length)}
    </>
  );
}

function matchedText(doc: LeaseDocument, p: Provenance): string | null {
  if (p.matchStart === undefined || p.matchEnd === undefined) return null;
  const page = doc.pages[p.pageNumber - 1];
  return page ? page.text.slice(p.matchStart, p.matchEnd).replace(/\s+/g, " ") : null;
}

function emphasize(text: string, phrases: string[]) {
  if (!phrases.length) return text;
  const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "gi"));
  return parts.map((part, i) =>
    phrases.some((p) => p.toLowerCase() === part.toLowerCase()) ? (
      <strong key={i} className="font-semibold text-foreground">{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function SourceItem({ source }: { source: LegalSource }) {
  return (
    <li className="rounded-lg border bg-background p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <OriginTag origin={source.origin} />
        <span className="text-[0.7rem] text-muted-foreground">
          {SOURCE_TYPE_LABEL[source.sourceType]}
          {source.isOfficial ? " · Official MA source" : " · Not an official source"}
        </span>
      </div>
      <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-sm font-medium text-primary hover:underline">
        {source.title}
        <ExternalLink className="mt-0.5 size-3 shrink-0" />
      </a>
      <p className="mt-0.5 truncate text-[0.7rem] text-muted-foreground">{source.url}</p>
      <blockquote className="mt-2 border-l-2 pl-3 text-xs leading-relaxed text-muted-foreground">
        {emphasize(source.excerpt, source.matchedPhrases ?? [])}
      </blockquote>
      <p className="mt-2 text-[0.7rem] text-muted-foreground">
        {source.origin === "live" ? "Retrieved" : "Captured"} {new Date(source.retrievedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: source.origin === "live" ? "short" : undefined })}
      </p>
    </li>
  );
}

export function FindingCard({ finding: f, document, expanded, activeEvidence, onToggle, onShowEvidence }: Props) {
  const pc = PRIORITY_CLASS[f.priority];
  const pages = [...new Set(f.evidence.map((e) => e.pageNumber))];
  const v = f.verification;
  return (
    <article
      id={`finding-${f.id}`}
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-card transition-shadow",
        expanded && "ring-2 ring-ring/40",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-4 text-left focus-visible:bg-muted/60 focus-visible:outline-none"
      >
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", pc.dot)} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <PriorityBadge priority={f.priority} />
            <span className="text-xs text-muted-foreground">{CATEGORY_LABEL[f.category]}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{KIND_LABEL[f.kind]}</span>
          </span>
          <span className="block font-medium text-pretty">{f.title}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {pages.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3.5" /> Page {pages.join(", ")}
              </span>
            )}
            {f.financialImpact && <span className="tabular-nums">{formatUSD(f.financialImpact.amount)} · {f.financialImpact.label}</span>}
            <VerificationBadge verification={v} compact />
          </span>
        </span>
        <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="space-y-5 border-t px-4 pt-4 pb-5 text-sm">
          <p className="leading-relaxed text-pretty">{f.explanation}</p>

          {f.evidence.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">From your lease</h4>
              <ul className="space-y-2">
                {f.evidence.map((e, i) => (
                  <li key={`${e.clauseId}-${i}`} className={cn("rounded-lg border p-3", activeEvidence === i ? "border-highlight-border bg-warning-soft/60" : "bg-muted/40")}>
                    <blockquote className="text-sm leading-relaxed">&ldquo;{markIn(e.excerpt, matchedText(document, e))}&rdquo;</blockquote>
                    <Button variant="link" size="sm" className="mt-1 h-auto px-0" onClick={() => onShowEvidence(i)}>
                      <FileText data-icon="inline-start" /> Show on page {e.pageNumber}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {f.financialImpact && (
            <section className="rounded-lg border bg-background p-3">
              <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Financial impact</h4>
              <p className="text-lg font-semibold tabular-nums">{formatUSD(f.financialImpact.amount)}</p>
              <p className="text-xs text-muted-foreground">{f.financialImpact.label} · <span className="font-mono">{f.financialImpact.formula}</span></p>
            </section>
          )}

          {v.status !== "not_applicable" && (
            <section>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Scale className="size-3.5" /> Massachusetts law
              </h4>
              <div className={cn("mb-2 rounded-lg p-3 text-xs leading-relaxed", v.status === "corroborated" ? "bg-success-soft" : v.status === "pending" ? "bg-muted" : "bg-warning-soft")}>
                <VerificationBadge verification={v} />
                <p className="mt-1 text-muted-foreground">{v.note}</p>
              </div>
              {v.supportingSources.length > 0 && (
                <ul className="space-y-2">{v.supportingSources.map((s, i) => <SourceItem key={`${s.url}-${i}`} source={s} />)}</ul>
              )}
              {v.consideredSources.length > v.supportingSources.length && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    {v.supportingSources.length ? "Other sources considered" : "Sources considered"} ({v.consideredSources.length - v.supportingSources.length})
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {v.consideredSources.filter((s) => !v.supportingSources.includes(s)).map((s, i) => <SourceItem key={`${s.url}-o${i}`} source={s} />)}
                  </ul>
                </details>
              )}
            </section>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <section className="rounded-lg bg-muted/50 p-3">
              <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><TriangleAlert className="size-3.5" /> Uncertainty</h4>
              <p className="text-xs leading-relaxed">{f.uncertainty}</p>
            </section>
            <section className="rounded-lg bg-accent/60 p-3">
              <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-accent-foreground"><Lightbulb className="size-3.5" /> Suggested action</h4>
              <p className="text-xs leading-relaxed">{f.suggestedAction}</p>
            </section>
          </div>
          {f.landlordQuestion && (
            <section className="flex gap-2 rounded-lg border border-dashed p-3">
              <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground">Ask your landlord</h4>
                <p className="text-sm">{f.landlordQuestion}</p>
              </div>
            </section>
          )}
          <p className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
            <HelpCircle className="size-3" /> A flagged clause is not automatically illegal. This is general information, not legal advice.
          </p>
        </div>
      )}
    </article>
  );
}

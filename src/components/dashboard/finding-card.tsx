"use client";

import { ExternalLink } from "lucide-react";
import type { LeaseDocument, LeaseFinding, LegalSource, Provenance } from "@/types/lease";
import { formatUSD } from "@/lib/analysis/money";
import { CATEGORY_LABEL, KIND_LABEL } from "@/components/findings/labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OriginPill, Pill, PriorityPill, VerificationPill } from "./bits";

interface Props {
  finding: LeaseFinding;
  document: LeaseDocument;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onShowEvidence: (index: number) => void;
}

export function pageLabel(f: LeaseFinding): string {
  const pages = [...new Set(f.evidence.map((e) => e.pageNumber))];
  return pages.length ? `Page ${pages.join(", ")}` : "No page";
}

export function impactText(f: LeaseFinding): string | null {
  return f.financialImpact ? `${formatUSD(f.financialImpact.amount)} · ${f.financialImpact.label}` : null;
}

export function FindingCard({ finding: f, document, expanded, selected, onToggle, onShowEvidence }: Props) {
  const impact = impactText(f);
  const v = f.verification;
  const sources = v.supportingSources.length ? v.supportingSources : v.consideredSources;
  const bodyId = `finding-body-${f.id}`;

  return (
    <article
      id={`finding-${f.id}`}
      className={cn("scroll-mt-4 rounded-lg border bg-card", selected && "border-primary ring-1 ring-primary")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className="block w-full rounded-lg px-4 py-3.5 text-left"
      >
        <span className="mb-2 flex flex-wrap items-center gap-1.5">
          <PriorityPill priority={f.priority} />
          <Pill className="bg-muted font-semibold text-foreground">{CATEGORY_LABEL[f.category]}</Pill>
          <Pill className="border font-semibold text-foreground">{KIND_LABEL[f.kind]}</Pill>
          <span className="ml-auto text-[0.8125rem] text-muted-foreground">{pageLabel(f)}</span>
        </span>
        <span className="block text-base leading-snug font-semibold text-pretty">{f.title}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-sm">
          {impact && <span className="text-foreground/80 tabular-nums">{impact}</span>}
          <VerificationPill status={v.status} />
        </span>
      </button>

      {expanded && (
        <div id={bodyId} className="flex flex-col gap-3.5 px-4 pb-4">
          <p className="border-t pt-3 text-pretty">{f.explanation}</p>

          {f.evidence.length > 0 && (
            <Block title="From your lease">
              <ul className="flex flex-col gap-2.5">
                {f.evidence.map((e, i) => (
                  <li key={`${e.clauseId}-${i}`}>
                    <blockquote className="rounded-md bg-background px-3.5 py-2.5 font-serif text-[0.9375rem]">
                      <Excerpt evidence={e} document={document} />
                    </blockquote>
                    <Button variant="outline" className="mt-2 h-10 bg-card px-3 font-semibold" onClick={() => onShowEvidence(i)}>
                      Show on page {e.pageNumber}
                    </Button>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {f.financialImpact && (
            <Block title="Impact">
              <p className="font-semibold tabular-nums">{impact}</p>
              <p className="mt-0.5 font-mono text-[0.8125rem] break-words text-muted-foreground">{f.financialImpact.formula}</p>
            </Block>
          )}

          {v.status !== "not_applicable" && (
            <Block title="Massachusetts law sources">
              {sources.length ? (
                <ul className="flex flex-col gap-2">
                  {sources.map((s, i) => (
                    <SourceBox key={`${s.url}-${i}`} source={s} />
                  ))}
                </ul>
              ) : null}
              {(!sources.length || v.status !== "corroborated") && (
                <p className={cn("text-sm text-muted-foreground", sources.length > 0 && "mt-2")}>{v.note}</p>
              )}
            </Block>
          )}

          <Block title="What we’re not sure about">
            <p>{f.uncertainty}</p>
          </Block>
          <Block title="Suggested action">
            <p>{f.suggestedAction}</p>
          </Block>
          {f.landlordQuestion && (
            <Block title="Question for your landlord">
              <p className="rounded-md bg-accent px-3.5 py-2.5 text-sm">{f.landlordQuestion}</p>
            </Block>
          )}
        </div>
      )}
    </article>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[0.8125rem] font-semibold text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

/** The clause excerpt, with the engine's narrower match (e.g. the amount) marked when it falls inside it. */
function Excerpt({ evidence: e, document }: { evidence: Provenance; document: LeaseDocument }) {
  const page = document.pages[e.pageNumber - 1];
  const clause = page ? page.text.slice(e.start, e.end) : e.excerpt;
  const ms = e.matchStart;
  const me = e.matchEnd;
  if (page && ms !== undefined && me !== undefined && ms >= e.start && me <= e.end && me > ms) {
    return (
      <>
        {clause.slice(0, ms - e.start)}
        <mark className="rounded-xs bg-highlight px-0.5 text-foreground ring-1 ring-highlight-border">{clause.slice(ms - e.start, me - e.start)}</mark>
        {clause.slice(me - e.start)}
      </>
    );
  }
  return <>{e.excerpt}</>;
}

function SourceBox({ source: s }: { source: LegalSource }) {
  const when = new Date(s.retrievedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: s.origin === "live" ? "short" : undefined });
  return (
    <li className="rounded-md border px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 font-semibold text-primary hover:underline">
          {s.title}
          <ExternalLink aria-hidden="true" className="mt-1 size-3 shrink-0" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <OriginPill origin={s.origin} />
      </div>
      <p className="mt-0.5 font-mono text-xs break-all text-muted-foreground">{s.url}</p>
      <p className="mt-1.5 text-sm text-foreground/80">“{s.excerpt}”</p>
      <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">{s.origin === "live" ? `Retrieved ${when}` : `Bundled copy captured ${when}`}</p>
    </li>
  );
}

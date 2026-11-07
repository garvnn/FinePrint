"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { LeaseDocument, LeaseFinding, LegalSource, Provenance } from "@/types/lease";
import { formatUSD } from "@/lib/analysis/money";
import { CATEGORY_LABEL, KIND_LABEL } from "@/components/findings/labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FindingNumber, OUTLINE_BUTTON, OriginPill, Pill, PriorityPill, SERIF, VerificationPill, highlighterStyle } from "./bits";

interface Props {
  finding: LeaseFinding;
  /** The finding's number, shared with its marks in the lease viewer. */
  number: number;
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

export function FindingCard({ finding: f, number, document, expanded, selected, onToggle, onShowEvidence }: Props) {
  const impact = impactText(f);
  const v = f.verification;
  const sources = v.supportingSources.length ? v.supportingSources : v.consideredSources;
  const bodyId = `finding-body-${f.id}`;

  return (
    <article
      id={`finding-${f.id}`}
      className={cn("scroll-mt-4 rounded-lg bg-card shadow-card", selected && "outline-2 outline-foreground")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={bodyId}
        className="flex w-full gap-3 rounded-lg px-4 py-3.5 text-left"
      >
        <FindingNumber n={number} priority={f.priority} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          <span className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <PriorityPill priority={f.priority} />
            <span className="ml-auto text-[0.8125rem] text-muted-foreground">{pageLabel(f)}</span>
          </span>
          <span className="block text-base leading-snug font-semibold text-pretty">{f.title}</span>
          {impact && <span className="mt-1 block text-sm text-foreground tabular-nums">{impact}</span>}
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <Pill className="bg-muted font-semibold text-muted-foreground">{CATEGORY_LABEL[f.category]}</Pill>
            <Pill className="border border-border font-semibold text-muted-foreground">{KIND_LABEL[f.kind]}</Pill>
            <VerificationPill status={v.status} />
          </span>
        </span>
      </button>

      {expanded && (
        <div id={bodyId} className="flex flex-col gap-4 border-t px-4 pt-3.5 pb-4 sm:pl-[3.25rem]">
          <Block title="What this means">
            <p className="text-pretty">{f.explanation}</p>
          </Block>

          {f.evidence.length > 0 && (
            <Block title="From your lease">
              <ul className="flex flex-col gap-2.5">
                {f.evidence.map((e, i) => (
                  <li key={`${e.clauseId}-${i}`}>
                    <blockquote className={cn("rounded-sm bg-background px-3.5 py-2.5 text-base leading-relaxed", SERIF)}>
                      <Excerpt evidence={e} document={document} priority={f.priority} />
                    </blockquote>
                    <Button variant="outline" className={`mt-2 h-10 px-3 font-semibold ${OUTLINE_BUTTON}`} onClick={() => onShowEvidence(i)}>
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
            <Block title="Massachusetts law">
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
            <Block title="Ask your landlord">
              <div className="rounded-md bg-muted px-3.5 py-3">
                <p className="text-sm">{f.landlordQuestion}</p>
                <CopyButton text={f.landlordQuestion} />
              </div>
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
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <Button
      className="mt-2.5 h-10 px-3.5 font-semibold"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          /* clipboard unavailable: the text can still be selected by hand */
        }
      }}
    >
      {copied ? <Check data-icon="inline-start" aria-hidden="true" /> : <Copy data-icon="inline-start" aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Copied" : "Copy question"}</span>
    </Button>
  );
}

/** The clause excerpt, with the engine's narrower match (e.g. the amount) marked when it falls inside it. */
function Excerpt({ evidence: e, document, priority }: { evidence: Provenance; document: LeaseDocument; priority: LeaseFinding["priority"] }) {
  const page = document.pages[e.pageNumber - 1];
  const clause = page ? page.text.slice(e.start, e.end) : e.excerpt;
  const ms = e.matchStart;
  const me = e.matchEnd;
  if (page && ms !== undefined && me !== undefined && ms >= e.start && me <= e.end && me > ms) {
    return (
      <>
        {clause.slice(0, ms - e.start)}
        <mark style={highlighterStyle(priority)} className="rounded-xs bg-highlight px-0.5 text-foreground">
          {clause.slice(ms - e.start, me - e.start)}
        </mark>
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
        <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 font-semibold text-ring underline-offset-2 hover:underline">
          {s.title}
          <ExternalLink aria-hidden="true" className="mt-1 size-3 shrink-0" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <OriginPill origin={s.origin} />
      </div>
      <p className="mt-0.5 font-mono text-xs break-all text-muted-foreground">{s.url}</p>
      <p className="mt-1.5 text-sm text-foreground">“{s.excerpt}”</p>
      <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">{s.origin === "live" ? `Retrieved ${when}` : `Bundled copy captured ${when}`}</p>
    </li>
  );
}

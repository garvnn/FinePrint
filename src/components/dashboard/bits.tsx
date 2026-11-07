import type { CSSProperties } from "react";
import type { FindingPriority, ResearchOrigin, VerificationStatus } from "@/types/lease";
import {
  PRIORITY_CLASS,
  PRIORITY_HIGHLIGHT,
  PRIORITY_LABEL,
  VERIFICATION_CLASS,
  VERIFICATION_SHORT_LABEL,
} from "@/components/findings/labels";
import { cn } from "@/lib/utils";

/** Source Serif 4 (loaded in app/layout.tsx): lease text, wordmark, H1s, report title. */
export const SERIF = "font-[family-name:var(--font-serif)]";

/** Secondary buttons: ink outline on white. Use with <Button variant="outline">. */
export const OUTLINE_BUTTON = "border-foreground bg-card text-foreground hover:bg-muted hover:text-foreground";

/** Inline style that turns a bg-highlight element into this priority's highlighter. */
export function highlighterStyle(priority: FindingPriority): CSSProperties {
  return { "--highlight": PRIORITY_HIGHLIGHT[priority] } as CSSProperties;
}

/** Fully rounded label pill. Colour always comes with text, never alone. */
export function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: FindingPriority }) {
  return <Pill className={PRIORITY_CLASS[priority].badge}>{PRIORITY_LABEL[priority]}</Pill>;
}

/** The finding's number in its highlighter colour; the same number marks its clause in the lease. */
export function FindingNumber({
  n,
  priority,
  className,
  style,
}: {
  n: number;
  priority: FindingPriority;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ ...highlighterStyle(priority), ...style }}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-highlight text-xs font-bold text-foreground tabular-nums ring-1 ring-foreground/15",
        className,
      )}
    >
      {n}
    </span>
  );
}

export function VerificationPill({ status }: { status: VerificationStatus }) {
  const label = VERIFICATION_SHORT_LABEL[status];
  if (!label) return null;
  return <Pill className={VERIFICATION_CLASS[status]}>Verification: {label}</Pill>;
}

export function OriginPill({ origin }: { origin: ResearchOrigin }) {
  return origin === "live" ? (
    <Pill className="bg-success-soft text-success">Live</Pill>
  ) : (
    <Pill className="bg-warning-soft text-warning">Bundled reference, not live</Pill>
  );
}

/** Highlighter swatches with text labels, shown above the lease. */
export function HighlighterLegend() {
  const items: FindingPriority[] = ["high", "medium", "low"];
  return (
    <ul aria-label="Highlighter colours" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {items.map((p) => (
        <li key={p} className="inline-flex items-center gap-2">
          <span aria-hidden="true" style={highlighterStyle(p)} className="h-3.5 w-7 rounded-xs bg-highlight -skew-x-12" />
          {PRIORITY_LABEL[p]}
        </li>
      ))}
    </ul>
  );
}

/** White card used for every block in the tab panels. */
export function Panel({
  title,
  description,
  className,
  children,
  titleId,
}: {
  title?: string;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  titleId?: string;
}) {
  return (
    <section aria-labelledby={title ? titleId : undefined} className={cn("rounded-lg bg-card px-5 py-[1.125rem] shadow-card", className)}>
      {title && (
        <h2 id={titleId} className={cn("text-lg font-bold", description ? "mb-1" : "mb-3")}>
          {title}
        </h2>
      )}
      {description && <p className="mb-3 text-sm text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}

export const DISCLAIMER = "A flagged clause is not automatically illegal. FinePrint is not legal advice.";

export function Disclaimer({ boxed = false }: { boxed?: boolean }) {
  return (
    <p className={cn("text-[0.8125rem]", boxed ? "rounded-md bg-priority-info-soft px-3.5 py-2.5 text-foreground" : "text-muted-foreground")}>
      {DISCLAIMER}
    </p>
  );
}

import type { FindingPriority, ResearchOrigin, VerificationStatus } from "@/types/lease";
import { PRIORITY_CLASS, PRIORITY_LABEL, VERIFICATION_CLASS, VERIFICATION_SHORT_LABEL } from "@/components/findings/labels";
import { cn } from "@/lib/utils";

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
    <section aria-labelledby={title ? titleId : undefined} className={cn("rounded-lg border bg-card px-5 py-[1.125rem]", className)}>
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
    <p className={cn("text-[0.8125rem]", boxed ? "rounded-md bg-priority-info-soft px-3.5 py-2.5 text-foreground/80" : "text-muted-foreground")}>
      {DISCLAIMER}
    </p>
  );
}

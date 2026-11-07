import { CircleAlert, CircleCheck, CircleDashed, CircleHelp, Loader2 } from "lucide-react";
import type { FindingPriority, FindingVerification } from "@/types/lease";
import { cn } from "@/lib/utils";
import { PRIORITY_CLASS, PRIORITY_LABEL, VERIFICATION_LABEL } from "./labels";

export function PriorityBadge({ priority, className }: { priority: FindingPriority; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap", PRIORITY_CLASS[priority].badge, className)}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

export function VerificationBadge({ verification, compact = false }: { verification: FindingVerification; compact?: boolean }) {
  const { status, origin } = verification;
  if (status === "not_applicable") return null;
  const icon =
    status === "pending" ? <Loader2 className="size-3.5 animate-spin" /> :
    status === "corroborated" ? <CircleCheck className="size-3.5" /> :
    status === "not_corroborated" ? <CircleHelp className="size-3.5" /> :
    <CircleAlert className="size-3.5" />;
  const tone =
    status === "corroborated" ? (origin === "live" ? "text-success" : "text-success") :
    status === "pending" ? "text-muted-foreground" :
    "text-warning";
  const suffix = status === "corroborated" ? (origin === "live" ? " · live" : " · bundled") : "";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap", tone)}>
      {icon}
      {compact ? (status === "corroborated" ? `Source${suffix}` : VERIFICATION_LABEL[status]) : `${VERIFICATION_LABEL[status]}${suffix}`}
    </span>
  );
}

export function OriginTag({ origin }: { origin: "live" | "bundled" }) {
  return origin === "live" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[0.7rem] font-medium text-success">
      <span className="size-1.5 rounded-full bg-success" /> Live search (Tavily)
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[0.7rem] font-medium text-warning">
      <CircleDashed className="size-3" /> Bundled reference, not live
    </span>
  );
}

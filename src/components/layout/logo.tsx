import Link from "next/link";
import { cn } from "@/lib/utils";

/** Legacy icon mark, still used by the old report view. Remove with the old components. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M10 8h9l5 5v11a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" className="fill-primary-foreground" opacity="0.95" />
      <rect x="11" y="16" width="10" height="1.6" rx="0.8" className="fill-primary/35" />
      <rect x="11" y="19.5" width="7" height="1.6" rx="0.8" className="fill-primary" />
    </svg>
  );
}

/** The FinePrint wordmark. Links home unless `href` is null. */
export function Logo({ href = "/", className }: { href?: string | null; className?: string }) {
  const cls = cn("text-xl font-bold tracking-[-0.02em] text-foreground", className);
  if (href === null) return <span className={cls}>FinePrint</span>;
  return (
    <Link href={href} className={cn(cls, "rounded-md no-underline")}>
      FinePrint
    </Link>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

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

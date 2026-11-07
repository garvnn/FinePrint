import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M10 8h9l5 5v11a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" fill="white" opacity="0.95" />
      <path d="M19 8v4a1 1 0 0 0 1 1h4" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-primary/40" />
      <rect x="11" y="16" width="10" height="1.6" rx="0.8" className="fill-primary/35" />
      <rect x="11" y="19.5" width="7" height="1.6" rx="0.8" className="fill-primary" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
      <LogoMark />
      <span className="text-[1.05rem]">FinePrint</span>
    </Link>
  );
}

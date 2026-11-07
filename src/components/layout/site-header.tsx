import Link from "next/link";
import { Logo } from "./logo";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#privacy", label: "Privacy" },
  { href: "/#who", label: "Who it’s for" },
];

export function SiteHeader() {
  return (
    <header data-print-hide className="border-b bg-card">
      <div className="mx-auto flex min-h-(--header-height) max-w-page flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="ml-auto flex flex-wrap gap-x-5 text-[0.9375rem]">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="inline-flex min-h-10 items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

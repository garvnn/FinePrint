import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer data-print-hide className="mt-auto border-t bg-card">
      <div className="mx-auto grid max-w-page gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Private, evidence-backed lease review for Massachusetts renters. Built for HACK1984.
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            FinePrint provides general information, not legal advice. It flags provisions for review; it does not decide whether a
            clause is legal or enforceable. For advice about your situation, contact a lawyer or a local tenant organization.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-medium">Product</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/analyze" className="hover:text-foreground">Analyze a lease</Link></li>
            <li><Link href="/analyze?sample=sample-a" className="hover:text-foreground">Problematic sample</Link></li>
            <li><Link href="/analyze?sample=sample-b" className="hover:text-foreground">Cleaner sample</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-medium">Trust</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/#privacy" className="hover:text-foreground">How your data is handled</Link></li>
            <li><a href="https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186" className="hover:text-foreground" target="_blank" rel="noreferrer">M.G.L. Chapter 186</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

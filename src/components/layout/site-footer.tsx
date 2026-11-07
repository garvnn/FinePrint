import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer data-print-hide className="mt-auto border-t bg-card">
      <div className="mx-auto flex max-w-page flex-wrap justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
        <Logo href={null} className="text-sm" />
        <p>Not legal advice. A flagged clause is not automatically illegal. Massachusetts residential leases only.</p>
      </div>
    </footer>
  );
}

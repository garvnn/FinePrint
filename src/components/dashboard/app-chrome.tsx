import { FilePlus2, Lock } from "lucide-react";
import type { LeaseDocument } from "@/types/lease";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

/** Header for /analyze. The file name and New lease button only appear once a lease is open. */
export function AppHeader({ document, onReset }: { document?: LeaseDocument | null; onReset?: () => void }) {
  return (
    <header data-print-hide className="border-b bg-card">
      <div className="mx-auto flex min-h-(--header-height) max-w-page flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 sm:px-6">
        <Logo />
        {document && (
          <span className="min-w-0 truncate text-sm text-muted-foreground" title={document.fileName}>
            {document.fileName}, {document.pageCount} page{document.pageCount === 1 ? "" : "s"}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
            <Lock aria-hidden="true" className="size-4" />
            Lease stays in this browser
          </span>
          {document && onReset && (
            <Button variant="outline" onClick={onReset} className="h-10 bg-card px-3.5 font-semibold">
              <FilePlus2 data-icon="inline-start" aria-hidden="true" />
              New lease
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer data-print-hide className="mt-auto border-t bg-card">
      <p className="mx-auto max-w-page px-4 py-4 text-[0.8125rem] text-muted-foreground sm:px-6">
        FinePrint is not legal advice. A flagged clause is not automatically illegal. For Massachusetts residential leases only.
      </p>
    </footer>
  );
}

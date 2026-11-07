import Link from "next/link";
import { ArrowRight, FileText, Lock, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_0%,var(--accent),transparent)]" />
      <div className="mx-auto grid max-w-page items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            For Massachusetts residential leases
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">Know Before You Sign.</h1>
          <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
            FinePrint reads your lease, totals what you&apos;ll actually pay, flags clauses worth questioning, and checks them
            against Massachusetts law, with the page and source for every finding. Your lease never leaves your device.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 px-5 text-[0.95rem]">
              <Link href="/analyze">
                <Upload data-icon="inline-start" />
                Upload lease
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-5 text-[0.95rem]">
              <Link href="/analyze?sample=sample-a">
                <FileText data-icon="inline-start" />
                Try sample lease
              </Link>
            </Button>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5"><Lock className="size-4 text-success" /> Analyzed in your browser</li>
            <li className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-success" /> No upload, no account</li>
          </ul>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

/** Static illustration of a real finding produced from Sample A. */
function HeroPreview() {
  return (
    <figure className="relative">
      <div className="rounded-2xl border bg-card p-5 shadow-raised">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Upfront cash required</p>
            <p className="text-2xl font-semibold tabular-nums">$6,725</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Findings</p>
            <p className="text-2xl font-semibold tabular-nums">15</p>
          </div>
        </div>
        <div className="rounded-xl border border-priority-high/25 bg-priority-high-soft p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-priority-high px-2 py-0.5 font-medium text-white">High priority</span>
            <span className="text-muted-foreground">Deposit · Page 1</span>
          </div>
          <p className="font-medium">Security deposit is $900 more than one month&apos;s rent</p>
          <blockquote className="mt-3 border-l-2 border-highlight-border bg-card/70 py-1.5 pr-2 pl-3 text-sm text-muted-foreground">
            &ldquo;Tenant shall pay a security deposit of <mark className="rounded bg-highlight px-0.5 text-foreground">$2,700.00</mark> upon signing this Lease.&rdquo;
          </blockquote>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-success" />
            Source: M.G.L. c. 186, § 15B · malegislature.gov
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          {["Upfront fee $350", "Late fee after 5 days", "Auto-renews: 90 days"].map((t) => (
            <div key={t} className="truncate rounded-lg border bg-muted/50 px-2 py-1.5 text-muted-foreground">{t}</div>
          ))}
        </div>
      </div>
      <figcaption className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground">
        Example output from the fictional sample lease <ArrowRight className="size-3" />
        <Link href="/analyze?sample=sample-a" className="font-medium text-primary hover:underline">see it live</Link>
      </figcaption>
    </figure>
  );
}

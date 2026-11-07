import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="mx-auto flex max-w-page flex-wrap items-center gap-12 px-4 pt-16 pb-14 sm:px-6 md:pt-[4.5rem] md:pb-16">
      <div className="min-w-0 flex-[1_1_440px]">
        <p className="mb-3.5 text-[0.9375rem] font-semibold text-primary">For Massachusetts renters</p>
        <h1 className="mb-[1.125rem] text-[clamp(2.75rem,6vw,4.5rem)] leading-[1.02] font-bold tracking-[-0.035em] text-balance">
          Know Before You Sign.
        </h1>
        <p className="mb-7 max-w-[32.5rem] text-lg text-pretty text-foreground/80 sm:text-[1.1875rem]">
          FinePrint reads your lease in your browser, shows what you’ll pay, flags clauses that appear to conflict with
          Massachusetts law, and links every finding to its source.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild className="h-12 px-[1.375rem] text-base font-semibold">
            <Link href="/analyze">Upload lease</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 border-primary bg-card px-[1.375rem] text-base font-semibold text-primary hover:bg-accent hover:text-primary"
          >
            <Link href="/analyze?sample=sample-a">Try sample lease</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Your lease never leaves this device.</p>
      </div>
      <HeroIllustration />
    </section>
  );
}

/** Decorative only: a lease excerpt with one highlighted clause and the finding it produces. */
function HeroIllustration() {
  return (
    <div aria-hidden="true" className="relative min-w-0 flex-[1_1_420px]">
      <div className="rounded-md border bg-card px-6 py-8 font-serif text-base leading-[1.7] shadow-raised sm:px-8 sm:py-9">
        <p className="mb-1.5 font-bold">Section 5. Deposits</p>
        <p>
          Upon signing this Lease, Tenant shall pay the first month’s rent of $1,800.00, the last month’s rent of $1,800.00,
          and{" "}
          <span className="rounded-xs bg-highlight box-decoration-clone ring-2 ring-highlight-border">
            a security deposit in the amount of $2,700.00
          </span>
          , to be held by Landlord in accordance with applicable law.
        </p>
      </div>
      <div className="relative -mt-[1.125rem] ml-auto w-[min(340px,92%)] rounded-lg border bg-card px-4 py-3.5 text-sm shadow-raised">
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-priority-high-soft px-2.5 py-0.5 text-xs font-bold text-priority-high">High priority</span>
          <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">Supported</span>
        </div>
        <p className="font-semibold">Deposit appears to exceed the Massachusetts limit</p>
        <p className="mt-0.5 text-muted-foreground">$900 above one month’s rent</p>
      </div>
    </div>
  );
}

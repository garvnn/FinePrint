import Link from "next/link";
import {
  ArrowRight,
  BadgeDollarSign,
  BookOpenCheck,
  Building2,
  Cpu,
  FileSearch,
  GraduationCap,
  Laptop,
  Lock,
  Scale,
  Search,
  Server,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-3 text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {children && <p className="mt-4 text-pretty text-muted-foreground">{children}</p>}
    </div>
  );
}

const BENEFITS = [
  {
    icon: BadgeDollarSign,
    title: "Understand your costs",
    body: "Monthly and annual rent, cash due at signing, recurring fees and penalties, kept separate so a refundable deposit is never counted as a cost. Every formula is shown.",
  },
  {
    icon: ShieldAlert,
    title: "Spot potential problems",
    body: "Deposits above one month's rent, extra move-in fees, early late fees, broad repair duties and auto-renewals, each tied to the exact clause and page.",
  },
  {
    icon: Lock,
    title: "Keep your lease private",
    body: "Parsing, extraction and math run in your browser. Only generic legal topics like “security deposit limits” are ever sent for research.",
  },
];

export function Benefits() {
  return (
    <section className="mx-auto max-w-page px-4 py-20 sm:px-6">
      <SectionHeading eyebrow="Why FinePrint" title="A lease review you can actually check">
        Not a chatbot. Every finding points to the sentence in your lease that triggered it and the legal source it relies on.
      </SectionHeading>
      <div className="grid gap-5 md:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-xl border bg-card p-6 shadow-card">
            <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <b.icon className="size-5" />
            </div>
            <h3 className="mb-2 font-semibold">{b.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{b.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { icon: FileSearch, title: "Open your lease PDF", body: "Drop in a text-based PDF. It is read on your device by PDF.js; nothing is uploaded." },
  { icon: Cpu, title: "FinePrint maps the risks", body: "A deterministic rule engine extracts amounts and clauses, calculates exposure and flags provisions to review." },
  { icon: BookOpenCheck, title: "Verify with Massachusetts law", body: "Official sources are retrieved for each topic, linked and timestamped. You get questions to ask before you sign." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y bg-card">
      <div className="mx-auto max-w-page px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="How it works" title="Three steps, about a minute" />
        <ol className="grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full border bg-background text-sm font-semibold tabular-nums">{i + 1}</span>
                <s.icon className="size-5 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function PrivacySection() {
  return (
    <section id="privacy" className="mx-auto max-w-page scroll-mt-20 px-4 py-20 sm:px-6">
      <SectionHeading eyebrow="Privacy by architecture" title="Your lease stays on your device. Here's exactly what doesn't.">
        Privacy isn&apos;t a promise in a policy. The app is built so the server can&apos;t receive your lease: its only
        endpoint accepts an allowlisted topic ID and rejects everything else.
      </SectionHeading>
      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-xl border-2 border-success/30 bg-success-soft/40 p-6">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <Laptop className="size-5 text-success" /> Your browser
          </div>
          <ul className="space-y-2 text-sm">
            {["PDF parsing (PDF.js, same-origin worker)", "Clause and amount extraction", "Financial calculations", "Findings, report and landlord letter", "Nothing stored after you close the tab"].map((t) => (
              <li key={t} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" />{t}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 px-2 text-center">
          <ArrowRight className="hidden size-5 text-muted-foreground lg:block" />
          <code className="rounded-lg border bg-card px-3 py-2 font-mono text-xs leading-relaxed shadow-card">
            {'{ "topicId": "ma-security-deposit-limits",'}<br />{'  "jurisdiction": "MA" }'}
          </code>
          <span className="max-w-[16rem] text-xs text-muted-foreground">The only data that leaves your device: a generic topic ID.</span>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-center gap-2 font-semibold">
            <Server className="size-5 text-muted-foreground" /> FinePrint server → Tavily
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {["Validates topic against an allowlist", "Builds the search query itself", "Searches official MA sources first", "Never receives lease text, names or addresses", "Logs only the topic ID and status"].map((t) => (
              <li key={t} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/60" />{t}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Every outgoing request is listed in the in-app Privacy Audit, with its exact payload.
      </p>
    </section>
  );
}

export function RentersSection() {
  return (
    <section id="renters" className="scroll-mt-20 border-t bg-card">
      <div className="mx-auto grid max-w-page gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-medium text-primary">Who it&apos;s for</p>
          <h2 className="text-3xl font-semibold tracking-tight text-balance">Built for first-time renters, starting with Massachusetts students</h2>
          <p className="mt-4 text-muted-foreground">
            Students and young renters often sign their first lease under time pressure, with thousands of dollars due up front and
            no one to review the terms. FinePrint turns a dense contract into the numbers, the risks and the questions to ask, with
            evidence they can show a landlord.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-11 px-5">
              <Link href="/analyze?sample=sample-a">See the problematic sample</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-5">
              <Link href="/analyze?sample=sample-b">Compare a cleaner lease</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { icon: GraduationCap, title: "Customer", body: "First-time renters; initial focus on Massachusetts college students." },
            { icon: Search, title: "Differentiation", body: "Clause-level evidence and verifiable official sources, with no document upload." },
            { icon: Building2, title: "Distribution (hypothesis)", body: "Universities, off-campus housing offices and tenant organizations licensing it for their communities." },
            { icon: Scale, title: "Business model (hypothesis)", body: "One-time reports for individuals, institutional licenses, and new jurisdictions over time. Pricing not yet validated." },
          ].map((c) => (
            <div key={c.title} className="rounded-xl border bg-background p-5">
              <c.icon className="mb-3 size-5 text-primary" />
              <h3 className="mb-1 text-sm font-semibold">{c.title}</h3>
              <p className="text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="mx-auto max-w-page px-4 py-20 sm:px-6">
      <div className="rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
        <h2 className="text-3xl font-semibold tracking-tight">Read the fine print before it costs you.</h2>
        <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">No account, no upload. Open a lease and see what you&apos;re agreeing to.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="secondary" className="h-11 px-5">
            <Link href="/analyze">Upload lease</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-11 px-5 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
            <Link href="/analyze?sample=sample-a">Try sample lease</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

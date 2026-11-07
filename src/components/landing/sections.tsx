import { CreditCard, Lock, SearchAlert, type LucideIcon } from "lucide-react";
import { RESEARCH_ENDPOINT } from "@/lib/research/client";

const BENEFITS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: CreditCard,
    title: "Understand your costs",
    body: "See what’s due at signing, what’s refundable, your first-year total and the charges that only apply if something happens.",
  },
  {
    icon: SearchAlert,
    title: "Spot potential problems",
    body: "Clauses that appear to conflict with Massachusetts rules are highlighted on the page, with the law that applies and a question to ask.",
  },
  {
    icon: Lock,
    title: "Keep your lease private",
    body: "Your lease is read in your browser. It isn’t uploaded, stored or sent to an AI service.",
  },
];

export function Benefits() {
  return (
    <section className="border-y bg-card">
      <div className="mx-auto grid max-w-page grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-8 px-4 py-14 sm:px-6">
        {BENEFITS.map((b) => (
          <div key={b.title}>
            <b.icon aria-hidden="true" className="size-7 text-primary" />
            <h2 className="mt-3 mb-1.5 text-xl font-semibold">{b.title}</h2>
            <p className="text-foreground/80">{b.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Open your lease", body: "Drop in a PDF. FinePrint reads it in your browser tab." },
  {
    title: "Check the law",
    body: "It looks up Massachusetts rules by topic only, like “security deposit limit,” and tells you whether each source is live or bundled.",
  },
  { title: "Review and ask", body: "Go through each finding on the page, then copy a letter with your questions for the landlord." },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-page scroll-mt-4 px-4 py-16 sm:px-6 md:py-[4.5rem]">
      <h2 className="mb-8 text-[2rem] leading-tight font-bold tracking-[-0.02em]">How it works</h2>
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-6">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-lg border bg-card p-6">
            <span aria-hidden="true" className="inline-flex size-9 items-center justify-center rounded-full bg-accent font-bold text-primary">
              {i + 1}
            </span>
            <h3 className="mt-3.5 mb-1.5 text-lg font-semibold">
              <span className="sr-only">Step {i + 1}: </span>
              {s.title}
            </h3>
            <p className="text-foreground/80">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/*
 * The body below is the exact shape requestResearch() sends
 * (src/lib/research/client.ts). Keep the two in sync.
 */
const EXAMPLE_BODY = JSON.stringify({ topicId: "ma-security-deposit-limits", jurisdiction: "MA" }, null, 2);

export function PrivacySection() {
  return (
    <section id="privacy" className="scroll-mt-4 bg-foreground text-background">
      <div className="mx-auto flex max-w-page flex-wrap items-center gap-10 px-4 py-16 sm:px-6 md:py-[4.5rem]">
        <div className="min-w-0 flex-[1_1_380px]">
          <h2 className="mb-3 text-[2rem] leading-tight font-bold tracking-[-0.02em]">This is all that leaves your device</h2>
          <p className="mb-3 text-[1.0625rem] text-background/80">
            To check Massachusetts law, FinePrint sends a topic name and a state. Never your lease text, your name or your address.
          </p>
          <p className="text-[1.0625rem] text-background/80">
            The Privacy tab shows every request, its exact body and the result of the privacy check, so you don’t have to take our
            word for it.
          </p>
        </div>
        <div className="min-w-0 flex-[1_1_380px]">
          <p className="mb-2 text-sm text-background/70">An actual research request</p>
          <pre className="rounded-lg border border-background/15 bg-background/10 p-5 font-mono text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap">
            {`POST ${RESEARCH_ENDPOINT}\n${EXAMPLE_BODY}`}
          </pre>
        </div>
      </div>
    </section>
  );
}

const AUDIENCES = [
  {
    title: "Renters",
    body: "First-time renters and students in Massachusetts who want to understand a lease before signing it.",
    hypothesis: "free for students, with a one-time report for other renters.",
  },
  {
    title: "Organizations",
    body: "University housing offices, tenant support groups and relocation services that help people find housing.",
    hypothesis: "organizations license FinePrint for the people they support.",
  },
];

export function WhoItsFor() {
  return (
    <section id="who" className="mx-auto max-w-page scroll-mt-4 px-4 py-16 sm:px-6 md:py-[4.5rem]">
      <h2 className="mb-2 text-[2rem] leading-tight font-bold tracking-[-0.02em]">Who it’s for</h2>
      <p className="mb-8 text-muted-foreground">Pricing below is a hypothesis we’re testing, not a final offer.</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
        {AUDIENCES.map((a) => (
          <div key={a.title} className="rounded-lg border bg-card p-6 sm:p-7">
            <h3 className="mb-2 text-[1.375rem] font-semibold">{a.title}</h3>
            <p className="mb-4 text-foreground/80">{a.body}</p>
            <p className="rounded-md bg-warning-soft px-3.5 py-3 text-sm text-warning">
              <strong>Hypothesis:</strong> {a.hypothesis}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

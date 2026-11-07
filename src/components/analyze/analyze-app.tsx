"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, CircleDashed, FilePlus2, Loader2, Printer, RefreshCw, TriangleAlert } from "lucide-react";
import type { FindingCategory } from "@/types/lease";
import { useLeaseSession, type LeaseSession } from "@/hooks/use-lease-session";
import { isSampleId, SAMPLE_LEASES } from "@/lib/fixtures/sample-leases";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadScreen } from "@/components/upload/upload-screen";
import { PdfViewer, type HighlightTarget } from "@/components/lease/pdf-viewer";
import { TextViewer } from "@/components/lease/text-viewer";
import { SummaryStrip } from "@/components/financial/summary-strip";
import { CostBreakdown } from "@/components/financial/cost-breakdown";
import { FindingsList, type PriorityFilter } from "@/components/findings/findings-list";
import { PrivacyAudit } from "@/components/privacy/privacy-audit";
import { ReportView } from "@/components/report/report-view";
import { OverviewPanel } from "./overview-panel";

export function AnalyzeApp() {
  const params = useSearchParams();
  const session = useLeaseSession(params.get("research") === "bundled" ? "bundled" : "live");
  const started = useRef(false);
  const urlSample = params.get("sample");
  // File name shown while loading. Chosen files and sample clicks set it; a ?sample= URL implies it.
  const [chosenName, setFileName] = useState<string | null>(null);
  const fileName = chosenName ?? (isSampleId(urlSample) ? SAMPLE_LEASES[urlSample].fileName : null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (isSampleId(urlSample)) void session.openSample(urlSample, { fixture: params.get("fixture") === "1" });
  }, [params, urlSample, session]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader session={session} />
      <main className="flex-1">
        {session.phase.kind === "ready" && session.analysis && session.document ? (
          <Dashboard session={session} />
        ) : session.phase.kind !== "ready" ? (
          <UploadScreen
            phase={session.phase}
            fileName={fileName}
            onFile={(f) => {
              setFileName(f.name);
              void session.openFile(f);
            }}
            onSample={(id) => {
              setFileName(SAMPLE_LEASES[id].fileName);
              void session.openSample(id);
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

function AppHeader({ session }: { session: LeaseSession }) {
  const ready = session.phase.kind === "ready";
  return (
    <header data-print-hide className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-(--header-height) max-w-[96rem] items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          {ready && session.document && (
            <span className="hidden truncate border-l pl-3 text-sm text-muted-foreground sm:inline" title={session.document.fileName}>
              {session.document.fileName}
            </span>
          )}
        </div>
        {ready && (
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="live-research"
                checked={session.researchMode === "live"}
                onCheckedChange={(v) => session.setResearchMode(v ? "live" : "bundled")}
              />
              <Label htmlFor="live-research" className="text-xs whitespace-nowrap sm:text-sm">Live legal search</Label>
            </div>
            <Button variant="outline" size="lg" onClick={session.reset}>
              <FilePlus2 data-icon="inline-start" />
              <span className="hidden sm:inline">New lease</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

function ResearchBanner({ session }: { session: LeaseSession }) {
  const entries = Object.values(session.research);
  if (!entries.length) return null;
  const loading = entries.some((e) => e?.status === "loading");
  const liveOk = entries.filter((e) => e?.status === "done" && !e.usedFallback).length;
  const fallback = entries.filter((e) => e?.status === "done" && e.usedFallback);
  const reason = fallback.find((e) => e?.live)?.live?.message;

  if (session.researchMode === "bundled") {
    return (
      <Banner tone="warn" icon={<CircleDashed className="size-4" />}>
        <strong>Demo mode:</strong> live legal search is off. Findings cite bundled excerpts of Massachusetts statutes captured from
        malegislature.gov, labeled &ldquo;Bundled reference, not live&rdquo;. No research requests are sent.
      </Banner>
    );
  }
  if (loading) {
    return <Banner tone="muted" icon={<Loader2 className="size-4 animate-spin" />}>Checking findings against Massachusetts law via live search…</Banner>;
  }
  if (fallback.length && !liveOk) {
    return (
      <Banner
        tone="warn"
        icon={<TriangleAlert className="size-4" />}
        action={<Button size="sm" variant="outline" onClick={session.retryResearch}><RefreshCw data-icon="inline-start" /> Retry</Button>}
      >
        <strong>Live verification unavailable.</strong> {reason ?? "The research service could not be reached."} Findings cite bundled
        statute excerpts instead, clearly labeled as not live.
      </Banner>
    );
  }
  return (
    <Banner tone="ok" icon={<CircleCheck className="size-4" />}>
      Legal sources retrieved by live search (Tavily) for {liveOk} topic{liveOk === 1 ? "" : "s"}
      {fallback.length ? `; ${fallback.length} topic(s) fell back to bundled references` : ""}. Official Massachusetts sources are ranked first.
    </Banner>
  );
}

function Banner({ tone, icon, children, action }: { tone: "ok" | "warn" | "muted"; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  const cls = tone === "ok" ? "border-success/30 bg-success-soft/60" : tone === "warn" ? "border-warning/40 bg-warning-soft" : "bg-muted";
  return (
    <div data-print-hide role="status" className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${cls}`}>
      <span className="shrink-0">{icon}</span>
      <p className="min-w-0 flex-1">{children}</p>
      {action}
    </div>
  );
}

function Dashboard({ session }: { session: LeaseSession }) {
  const analysis = session.analysis!;
  const doc = session.document!;
  const findings = session.findings;
  const [tab, setTab] = useState("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeEvidence, setActiveEvidence] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [highlight, setHighlight] = useState<HighlightTarget | null>(null);
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [category, setCategory] = useState<FindingCategory | "all">("all");
  const viewerRef = useRef<HTMLDivElement>(null);

  const showEvidence = (findingId: string, index: number, scroll = true) => {
    const f = findings.find((x) => x.id === findingId);
    const e = f?.evidence[index];
    setSelectedId(findingId);
    setActiveEvidence(e ? index : null);
    if (!e) {
      setHighlight(null);
      return;
    }
    setPage(e.pageNumber);
    setHighlight({ pageNumber: e.pageNumber, start: e.start, end: e.end });
    if (scroll && window.matchMedia("(max-width: 1023px)").matches) {
      viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const selectFinding = (id: string | null) => {
    if (!id) {
      setSelectedId(null);
      setActiveEvidence(null);
      setHighlight(null);
      return;
    }
    showEvidence(id, 0, false);
  };

  const openFinding = (id: string) => {
    setPriority("all");
    setCategory("all");
    setTab("findings");
    selectFinding(id);
    requestAnimationFrame(() => document.getElementById(`finding-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const isReport = tab === "report";

  return (
    <div className="mx-auto max-w-[96rem] space-y-4 px-4 py-5">
      <div data-print-hide className="space-y-4">
        <ResearchBanner session={session} />
        <SummaryStrip financial={analysis.financial} findings={findings} />
      </div>

      <div className={isReport ? "print:block" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] print:block"}>
        {!isReport && (
          <aside
            ref={viewerRef}
            data-print-hide
            aria-label="Original lease"
            className="order-2 h-[75vh] scroll-mt-20 overflow-hidden rounded-xl border bg-card shadow-card lg:sticky lg:top-[calc(var(--header-height)+1rem)] lg:order-1 lg:h-[calc(100vh-var(--header-height)-2rem)]"
          >
            {session.pdf ? (
              <PdfViewer pdf={session.pdf} document={doc} page={page} onPageChange={setPage} highlight={highlight} />
            ) : (
              <TextViewer document={doc} page={page} onPageChange={setPage} highlight={highlight} />
            )}
          </aside>
        )}

        <section className="order-1 min-w-0 lg:order-2">
          <Tabs value={tab} onValueChange={setTab}>
            <div data-print-hide className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <TabsList className="h-9 w-full sm:w-fit">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="findings">Findings <span className="ml-1 text-xs tabular-nums opacity-60">{findings.length}</span></TabsTrigger>
                <TabsTrigger value="costs">Costs</TabsTrigger>
                <TabsTrigger value="privacy">Privacy</TabsTrigger>
                <TabsTrigger value="report">Report</TabsTrigger>
              </TabsList>
              {!isReport && (
                <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => setTab("report")}>
                  <Printer data-icon="inline-start" /> Report
                </Button>
              )}
            </div>
            <TabsContent value="overview">
              <OverviewPanel
                findings={findings}
                research={session.research}
                topics={analysis.researchTopics}
                onOpenFinding={openFinding}
                onOpenCategory={(c) => {
                  setPriority("all");
                  setCategory(c);
                  setTab("findings");
                }}
                onOpenTab={setTab}
              />
            </TabsContent>
            <TabsContent value="findings">
              <FindingsList
                findings={findings}
                document={doc}
                selectedId={selectedId}
                activeEvidence={activeEvidence}
                onSelect={selectFinding}
                onShowEvidence={(id, i) => showEvidence(id, i)}
                priority={priority}
                onPriorityChange={setPriority}
                category={category}
                onCategoryChange={setCategory}
              />
            </TabsContent>
            <TabsContent value="costs">
              <CostBreakdown financial={analysis.financial} overrides={session.overrides} onOverridesChange={session.setOverrides} />
            </TabsContent>
            <TabsContent value="privacy">
              <PrivacyAudit />
            </TabsContent>
            <TabsContent value="report">
              <ReportView analysis={analysis} findings={findings} />
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  );
}

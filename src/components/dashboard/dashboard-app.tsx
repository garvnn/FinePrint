"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLeaseSession, type LeaseSession } from "@/hooks/use-lease-session";
import { buildLandlordLetter } from "@/lib/report/build";
import { isSampleId, SAMPLE_LEASES } from "@/lib/fixtures/sample-leases";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadScreen } from "@/components/upload/upload-screen";
import { AppFooter, AppHeader } from "./app-chrome";
import { ResearchBanner } from "./research-banner";
import { SummaryStrip } from "./summary-strip";
import { LeaseViewer, type ViewerMark } from "./lease-viewer";
import { HighlighterLegend, SERIF } from "./bits";
import { OverviewTab } from "./overview-tab";
import { FindingsTab, type CategoryFilter, type PriorityFilter } from "./findings-tab";
import { CostsTab } from "./costs-tab";
import { PrivacyTab } from "./privacy-tab";
import { ReportTab } from "./report-tab";

/** /analyze: upload states until a lease is ready, then the dashboard. */
export function DashboardApp() {
  const params = useSearchParams();
  const urlSample = params.get("sample");
  const startedInDemo = params.get("research") === "bundled";
  const session = useLeaseSession(startedInDemo ? "bundled" : "live");
  const started = useRef(false);
  // "Demo mode" while the page is still in the mode it was opened with; "Live search is off" once the user turns it off.
  const [userToggled, setUserToggled] = useState(false);
  // File name shown while loading. Chosen files and sample clicks set it; a ?sample= URL implies it.
  const [chosenName, setChosenName] = useState<string | null>(null);
  const fileName = chosenName ?? (isSampleId(urlSample) ? SAMPLE_LEASES[urlSample].fileName : null);
  // Held here so the header can switch to the Privacy tab.
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (isSampleId(urlSample)) void session.openSample(urlSample, { fixture: params.get("fixture") === "1" });
  }, [params, urlSample, session]);

  const ready = session.phase.kind === "ready" && session.analysis && session.document;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        document={ready ? session.document : null}
        onReset={() => {
          setTab("overview");
          session.reset();
        }}
        onShowPrivacy={() => setTab("privacy")}
      />
      <main className="flex-1">
        {ready ? (
          <Dashboard
            key={session.document!.id}
            session={session}
            tab={tab}
            onTabChange={setTab}
            demo={startedInDemo && !userToggled}
            onModeChange={(live) => {
              setUserToggled(true);
              session.setResearchMode(live ? "live" : "bundled");
            }}
          />
        ) : session.phase.kind !== "ready" ? (
          <UploadScreen
            phase={session.phase}
            fileName={fileName}
            onFile={(f) => {
              setChosenName(f.name);
              void session.openFile(f);
            }}
            onSample={(id) => {
              setChosenName(SAMPLE_LEASES[id].fileName);
              void session.openSample(id);
            }}
          />
        ) : null}
      </main>
      <AppFooter />
    </div>
  );
}

type Tab = "overview" | "findings" | "costs" | "privacy" | "report";

const TRIGGER =
  "h-11 flex-none rounded-none border-0 border-b-[3px] border-transparent px-4 text-[0.9375rem] font-medium text-foreground/80 after:hidden hover:text-foreground data-active:border-primary data-active:bg-transparent data-active:font-bold data-active:text-primary data-active:shadow-none data-active:ring-0 focus-visible:ring-0";

function Dashboard({
  session,
  tab,
  onTabChange: setTab,
  demo,
  onModeChange,
}: {
  session: LeaseSession;
  tab: Tab;
  onTabChange: (t: Tab) => void;
  demo: boolean;
  onModeChange: (live: boolean) => void;
}) {
  const analysis = session.analysis!;
  const doc = session.document!;
  const findings = session.findings;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [letterDraft, setLetterDraft] = useState<string | null>(null);
  const viewerRef = useRef<HTMLElement>(null);

  // If corrections remove the selected finding, drop the selection with it.
  const selected = findings.find((f) => f.id === selectedId) ?? null;

  /** Select a finding and turn the viewer to its evidence. No evidence: the page stays and nothing is highlighted. */
  const select = (id: string, evidenceIndex = 0) => {
    const e = findings.find((f) => f.id === id)?.evidence[evidenceIndex];
    setSelectedId(id);
    if (e) setPage(e.pageNumber);
  };

  // Every finding's evidence as a viewer mark, numbered in list order. Positions come from the engine only.
  const marks: ViewerMark[] = findings.flatMap((f, i) =>
    f.evidence.map((e, j) => ({
      key: `${f.id}-${j}`,
      number: i + 1,
      priority: f.priority,
      pageNumber: e.pageNumber,
      start: e.start,
      end: e.end,
      selected: f.id === selected?.id,
    })),
  );
  const toCheck = findings.filter((f) => f.priority === "high" || f.priority === "medium").length;

  const toggle = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    select(id);
  };

  const showEvidence = (id: string, index: number) => {
    select(id, index);
    // On narrow screens the viewer is above the findings; bring it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openFinding = (id: string) => {
    setPriority("all");
    setCategory("all");
    setTab("findings");
    setExpandedId(id);
    select(id);
    requestAnimationFrame(() => document.getElementById(`finding-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-0">
      <div className="mx-auto w-full max-w-page px-4 pt-5 sm:px-6">
        <div data-print-hide className="flex flex-col gap-4">
          <ResearchBanner session={session} topics={analysis.researchTopics} demo={demo} onModeChange={onModeChange} />
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pt-2">
            <h1 className={`text-[clamp(1.75rem,3.5vw,2.375rem)] leading-tight font-semibold tracking-[-0.01em] ${SERIF}`}>
              {toCheck} {toCheck === 1 ? "thing" : "things"} to check before you sign
            </h1>
            <HighlighterLegend />
          </div>
          <SummaryStrip analysis={analysis} findings={findings} />
        </div>
        <TabsList
          variant="line"
          aria-label="Dashboard sections"
          data-print-hide
          className="mt-5 flex h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b p-0 group-data-horizontal/tabs:h-auto"
        >
          <TabsTrigger value="overview" className={TRIGGER}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="findings" className={TRIGGER}>
            Findings ({findings.length})
          </TabsTrigger>
          <TabsTrigger value="costs" className={TRIGGER}>
            Costs
          </TabsTrigger>
          <TabsTrigger value="privacy" className={TRIGGER}>
            Privacy
          </TabsTrigger>
          <TabsTrigger value="report" className={TRIGGER}>
            Report
          </TabsTrigger>
        </TabsList>
      </div>

      <div className="mx-auto flex w-full max-w-page flex-wrap items-start gap-5 px-4 pt-5 pb-10 sm:px-6 print:block print:p-0">
        <LeaseViewer
          ref={viewerRef}
          pdf={session.pdf}
          document={doc}
          page={page}
          onPageChange={setPage}
          marks={marks}
          findingSelected={Boolean(selected)}
        />
        <div className="min-w-0 flex-[1_1_460px]">
          <TabsContent value="overview" className="text-[0.9375rem]">
            <OverviewTab
              findings={findings}
              topics={analysis.researchTopics}
              research={session.research}
              researchMode={session.researchMode}
              onOpenFinding={openFinding}
            />
          </TabsContent>
          <TabsContent value="findings" className="text-[0.9375rem]">
            <FindingsTab
              findings={findings}
              document={doc}
              priority={priority}
              category={category}
              onPriorityChange={setPriority}
              onCategoryChange={setCategory}
              expandedId={expandedId}
              selectedId={selected?.id ?? null}
              onToggle={toggle}
              onShowEvidence={showEvidence}
            />
          </TabsContent>
          <TabsContent value="costs" className="text-[0.9375rem]">
            <CostsTab analysis={analysis} overrides={session.overrides} onOverridesChange={session.setOverrides} />
          </TabsContent>
          <TabsContent value="privacy" className="text-[0.9375rem]">
            <PrivacyTab />
          </TabsContent>
          <TabsContent value="report" className="text-[0.9375rem]">
            <ReportTab
              analysis={analysis}
              findings={findings}
              letter={letterDraft ?? buildLandlordLetter(findings)}
              onLetterChange={setLetterDraft}
            />
          </TabsContent>
        </div>
      </div>
    </Tabs>
  );
}

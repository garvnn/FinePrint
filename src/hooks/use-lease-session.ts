"use client";

/**
 * The single client-side controller for an analysis session. UI components
 * read from and call into this hook; all business logic lives in src/lib.
 * State is in memory only — closing the tab discards everything.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type {
  AnalysisResult,
  FinancialOverrides,
  LeaseDocument,
  LeaseFinding,
  ResearchResponse,
  ResearchTopicId,
} from "@/types/lease";
import { analyzeLease } from "@/lib/analysis/analyze";
import { applyResearch, type ResearchMap } from "@/lib/analysis/verify";
import { sortFindings } from "@/lib/analysis/rules";
import { loadPdfFromBytes, loadPdfFromFile, PdfLoadError } from "@/lib/pdf/load";
import { bundledResearch, requestResearch } from "@/lib/research/client";
import { BUNDLED_CAPTURED_AT } from "@/lib/research/bundled";
import { clearAudit, recordAudit } from "@/lib/privacy/audit";
import { SAMPLE_LEASES, sampleToDocument, samplePdfUrl, type SampleId } from "@/lib/fixtures/sample-leases";

export type ResearchMode = "live" | "bundled";

export type Phase =
  | { kind: "idle" }
  | { kind: "loading"; label: string; progress?: number }
  | { kind: "error"; message: string }
  | { kind: "ready" };

export interface TopicResearch {
  status: "loading" | "done";
  /** The live attempt, if one was made. */
  live?: ResearchResponse;
  /** What is applied to findings (live result or bundled fallback). */
  effective?: ResearchResponse;
  usedFallback: boolean;
}

export interface LeaseSession {
  phase: Phase;
  document: LeaseDocument | null;
  pdf: PDFDocumentProxy | null;
  analysis: AnalysisResult | null;
  findings: LeaseFinding[];
  overrides: FinancialOverrides;
  setOverrides: (o: FinancialOverrides) => void;
  researchMode: ResearchMode;
  setResearchMode: (m: ResearchMode) => void;
  research: Partial<Record<ResearchTopicId, TopicResearch>>;
  retryResearch: () => void;
  openFile: (file: File) => Promise<void>;
  openSample: (id: SampleId, opts?: { fixture?: boolean }) => Promise<void>;
  reset: () => void;
}

const bundledNote = (reason: string) =>
  `${reason} Showing bundled statute excerpts captured ${BUNDLED_CAPTURED_AT.slice(0, 10)} from malegislature.gov. This is not a live search.`;

export function useLeaseSession(initialMode: ResearchMode = "live"): LeaseSession {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [document, setDocument] = useState<LeaseDocument | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [overrides, setOverrides] = useState<FinancialOverrides>({});
  const [researchMode, setResearchModeState] = useState<ResearchMode>(initialMode);
  const [research, setResearch] = useState<Partial<Record<ResearchTopicId, TopicResearch>>>({});
  const requested = useRef(new Set<string>());
  const docRef = useRef<LeaseDocument | null>(null);

  const analysis = useMemo(() => (document && document.hasExtractableText ? analyzeLease(document, overrides) : null), [document, overrides]);

  // Audit: record each local analysis run (backed by the actual computation above).
  useEffect(() => {
    if (!analysis) return;
    recordAudit({
      type: "local",
      step: "analysis",
      detail: `Segmented ${analysis.clauses.length} clauses, extracted ${analysis.terms.length} financial terms and produced ${analysis.findings.length} findings in this browser tab${
        Object.keys(overrides).length ? " (recalculated with your corrections)" : ""
      }.`,
    });
  }, [analysis, overrides]);

  const findings = useMemo(() => {
    if (!analysis) return [];
    const map: ResearchMap = {};
    for (const [topic, r] of Object.entries(research)) if (r?.effective) map[topic as ResearchTopicId] = r.effective;
    return sortFindings(applyResearch(analysis.findings, map));
  }, [analysis, research]);

  // Run research for each topic referenced by the findings.
  useEffect(() => {
    if (!analysis) return;
    const req = requested.current;
    const topics = analysis.researchTopics.filter((t) => !req.has(`${researchMode}:${t}`));
    if (!topics.length) return;
    topics.forEach((t) => req.add(`${researchMode}:${t}`));
    setResearch((prev) => {
      const next = { ...prev };
      for (const t of topics) next[t] = { status: "loading", usedFallback: false };
      return next;
    });

    let cancelled = false;
    const done = new Set<ResearchTopicId>();
    (async () => {
      for (const topic of topics) {
        let entry: TopicResearch;
        if (researchMode === "bundled") {
          entry = { status: "done", effective: bundledResearch(topic, bundledNote("Demo mode: live search is off.")), usedFallback: true };
        } else {
          const live = await requestResearch(topic, docRef.current);
          entry =
            live.status === "ok"
              ? { status: "done", live, effective: live, usedFallback: false }
              : {
                  status: "done",
                  live,
                  effective: bundledResearch(topic, bundledNote(`Live verification unavailable: ${live.message ?? live.status}.`)),
                  usedFallback: true,
                };
        }
        if (cancelled) return;
        done.add(topic);
        setResearch((prev) => ({ ...prev, [topic]: entry }));
      }
    })();
    return () => {
      cancelled = true;
      // Allow re-request if this effect was interrupted.
      topics.filter((t) => !done.has(t)).forEach((t) => req.delete(`${researchMode}:${t}`));
    };
  }, [analysis, researchMode]);

  const setResearchMode = useCallback((m: ResearchMode) => {
    requested.current.clear();
    setResearch({});
    setResearchModeState(m);
  }, []);

  const retryResearch = useCallback(() => {
    requested.current.clear();
    setResearch({});
  }, []);

  const adopt = useCallback((doc: LeaseDocument, proxy: PDFDocumentProxy | null) => {
    docRef.current = doc;
    requested.current.clear();
    setResearch({});
    setOverrides({});
    setDocument(doc);
    setPdf((old) => {
      if (old && old !== proxy) void old.loadingTask.destroy();
      return proxy;
    });
    if (!doc.hasExtractableText) {
      setPhase({
        kind: "error",
        message:
          "This PDF has no extractable text. It may be a scanned image. FinePrint does not upload documents for OCR; try a text-based PDF (for example, one exported from Word or a leasing portal).",
      });
      return;
    }
    setPhase({ kind: "ready" });
  }, []);

  const openFile = useCallback(
    async (file: File) => {
      clearAudit();
      setPhase({ kind: "loading", label: `Reading ${file.name} on your device…` });
      try {
        const { document: doc, pdf: proxy } = await loadPdfFromFile(file, (d, t) =>
          setPhase({ kind: "loading", label: `Extracting text locally: page ${d} of ${t}`, progress: d / t }),
        );
        recordAudit({
          type: "local",
          step: "pdf_parse",
          detail: `Parsed "${file.name}" (${doc.pageCount} page${doc.pageCount === 1 ? "" : "s"}, ${(file.size / 1024).toFixed(0)} KB) with PDF.js in a same-origin Web Worker. The file was read from your disk with the File API and was not uploaded.`,
        });
        adopt(doc, proxy);
      } catch (err) {
        setPhase({ kind: "error", message: err instanceof PdfLoadError ? err.message : "Something went wrong while reading this PDF." });
      }
    },
    [adopt],
  );

  const openSample = useCallback(
    async (id: SampleId, opts: { fixture?: boolean } = {}) => {
      clearAudit();
      const sample = SAMPLE_LEASES[id];
      if (opts.fixture) {
        const doc = sampleToDocument(sample);
        recordAudit({ type: "local", step: "pdf_parse", detail: `Fixture mode: loaded the fictional "${sample.fileName}" text directly (no PDF, no network).` });
        adopt(doc, null);
        return;
      }
      setPhase({ kind: "loading", label: "Loading the fictional sample lease…" });
      try {
        const res = await fetch(samplePdfUrl(id));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const bytes = await res.arrayBuffer();
        recordAudit({
          type: "local",
          step: "sample_fetch",
          detail: `Downloaded the public, fictional sample file ${samplePdfUrl(id)} from FinePrint. This is a download of demo content, not an upload of your data.`,
        });
        const { document: doc, pdf: proxy } = await loadPdfFromBytes(bytes, sample.fileName, "sample");
        recordAudit({
          type: "local",
          step: "pdf_parse",
          detail: `Parsed "${sample.fileName}" (${doc.pageCount} pages) with PDF.js in a same-origin Web Worker.`,
        });
        adopt(doc, proxy);
      } catch {
        setPhase({ kind: "error", message: "Could not load the sample lease. Check your connection and try again." });
      }
    },
    [adopt],
  );

  const reset = useCallback(() => {
    setPdf((old) => {
      if (old) void old.loadingTask.destroy();
      return null;
    });
    docRef.current = null;
    requested.current.clear();
    setDocument(null);
    setOverrides({});
    setResearch({});
    clearAudit();
    setPhase({ kind: "idle" });
  }, []);

  return {
    phase,
    document,
    pdf,
    analysis,
    findings,
    overrides,
    setOverrides,
    researchMode,
    setResearchMode,
    research,
    retryResearch,
    openFile,
    openSample,
    reset,
  };
}

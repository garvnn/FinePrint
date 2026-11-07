"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { FindingPriority, LeaseDocument, LeasePage, TextSpan } from "@/types/lease";
import { spansForRange } from "@/lib/pdf/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FindingNumber, OUTLINE_BUTTON, SERIF, highlighterStyle } from "./bits";

/**
 * One cited range of the lease, straight from a finding's evidence.
 * `number` is the finding's number in the list; `selected` marks the open finding.
 */
export interface ViewerMark {
  key: string;
  number: number;
  priority: FindingPriority;
  pageNumber: number;
  start: number;
  end: number;
  selected: boolean;
}

interface Props {
  pdf: PDFDocumentProxy | null;
  document: LeaseDocument;
  page: number;
  onPageChange: (page: number) => void;
  /** Marks for every finding, in finding order (highest priority first). */
  marks: ViewerMark[];
  /** A finding is selected (so "nothing highlighted" needs explaining). */
  findingSelected: boolean;
}

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

/** Which mark owns a piece of text when several overlap: the selected one, else the first (highest priority). */
const wins = (candidate: ViewerMark, current: ViewerMark | undefined) => !current || (candidate.selected && !current.selected);

export const LeaseViewer = forwardRef<HTMLElement, Props>(function LeaseViewer(
  { pdf, document, page, onPageChange, marks, findingSelected },
  ref,
) {
  const [zoom, setZoom] = useState(100);
  const pageData = document.pages[page - 1];
  const here = marks.filter((m) => m.pageNumber === page);
  const selectedMarks = marks.filter((m) => m.selected);
  const selectedHere = here.filter((m) => m.selected);

  // PDF: only positioned spans from PDF.js, each span drawn once by its winning mark.
  const spanOwner = new Map<TextSpan, ViewerMark>();
  const markStart = new Map<string, TextSpan>();
  if (pdf && pageData) {
    for (const m of here) {
      const spans = spansForRange(pageData, m.start, m.end);
      if (spans[0]) markStart.set(m.key, spans[0]);
      for (const s of spans) if (wins(m, spanOwner.get(s))) spanOwner.set(s, m);
    }
  }
  const selectedDrawnOnPdf = selectedHere.some((m) => markStart.has(m.key));
  const drawn = selectedHere.length > 0 && (pdf ? selectedDrawnOnPdf : true);
  const noPosition = findingSelected && (selectedMarks.length === 0 || Boolean(pdf && selectedHere.length && !selectedDrawnOnPdf));

  return (
    <aside
      ref={ref}
      data-print-hide
      aria-label="Lease viewer"
      className="flex h-[min(80vh,980px)] min-w-0 flex-[1_1_460px] scroll-mt-4 flex-col overflow-hidden rounded-lg bg-card shadow-card lg:sticky lg:top-4"
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button variant="outline" size="icon" className={`size-10 ${OUTLINE_BUTTON} border-border`} aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="min-w-24 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          Page {page} of {document.pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          className={`size-10 ${OUTLINE_BUTTON} border-border`}
          aria-label="Next page"
          disabled={page >= document.pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className={`size-10 ${OUTLINE_BUTTON} border-border`}
            aria-label="Zoom out"
            disabled={zoom <= ZOOM_MIN}
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
          >
            <Minus aria-hidden="true" />
          </Button>
          <span className="min-w-12 text-center text-sm tabular-nums" aria-label={`Zoom ${zoom}%`}>
            {zoom}%
          </span>
          <Button
            variant="outline"
            size="icon"
            className={`size-10 ${OUTLINE_BUTTON} border-border`}
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_MAX}
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>
      {noPosition && (
        <p className="border-b bg-priority-info-soft px-3.5 py-2.5 text-sm text-foreground">
          This finding isn’t tied to a spot in the PDF, so nothing is highlighted.
        </p>
      )}
      {pdf ? (
        <PdfPage pdf={pdf} page={page} zoom={zoom} spanOwner={spanOwner} markStart={markStart} marks={here} />
      ) : (
        <TextPage page={pageData} zoom={zoom} marks={here} />
      )}
      {drawn && (
        <p className="border-t bg-card px-3.5 py-1.5 text-xs text-muted-foreground">Highlighted: the lines containing the cited clause.</p>
      )}
    </aside>
  );
});

function PdfPage({
  pdf,
  page,
  zoom,
  spanOwner,
  markStart,
  marks,
}: {
  pdf: PDFDocumentProxy;
  page: number;
  zoom: number;
  spanOwner: Map<TextSpan, ViewerMark>;
  markStart: Map<string, TextSpan>;
  marks: ViewerMark[];
}) {
  const wellRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(true);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = sizerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !canvasRef.current) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    setRendering(true);
    (async () => {
      const p = await pdf.getPage(page);
      if (cancelled) return;
      const base = p.getViewport({ scale: 1 });
      const s = (width / base.width) * (zoom / 100);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = p.getViewport({ scale: s * dpr });
      const canvas = canvasRef.current!;
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
      canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
      task = p.render({ canvas, viewport: vp });
      try {
        await task.promise;
        if (!cancelled) {
          setScale(s);
          setRendering(false);
        }
      } catch {
        /* render cancelled */
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, page, width, zoom]);

  // Scroll to the selected finding's first line.
  const selectedTop = marks
    .filter((m) => m.selected)
    .map((m) => markStart.get(m.key)?.y)
    .filter((y): y is number => y !== undefined)
    .sort((a, b) => a - b)[0];
  useEffect(() => {
    if (rendering || selectedTop === undefined || !wellRef.current) return;
    wellRef.current.scrollTo({ top: Math.max(0, selectedTop * scale - 80), behavior: "smooth" });
  }, [rendering, selectedTop, scale]);

  // One numbered circle per mark, at the start of its first line. Circles that share a start stack leftwards.
  const stacked = new Map<TextSpan, number>();
  const circles = marks.flatMap((m) => {
    const s = markStart.get(m.key);
    if (!s) return [];
    const i = stacked.get(s) ?? 0;
    stacked.set(s, i + 1);
    return [{ m, s, i }];
  });

  return (
    <div ref={wellRef} className="min-h-0 flex-1 overflow-auto bg-background p-4 sm:p-8">
      <div ref={sizerRef} className="w-full">
        <div className="relative mx-auto w-fit rounded-sm bg-card shadow-card">
          {rendering && <Skeleton className="absolute inset-0 rounded-sm" />}
          <canvas ref={canvasRef} className="block rounded-sm" role="img" aria-label={`Lease page ${page}`} />
          {!rendering &&
            [...spanOwner.entries()].map(([r, m], i) => (
              <div
                key={i}
                aria-hidden="true"
                style={{ ...highlighterStyle(m.priority), left: r.x * scale - 2, top: r.y * scale - 1, width: r.width * scale + 4, height: r.height * scale + 2 }}
                className={cn("pointer-events-none absolute rounded-xs bg-highlight mix-blend-multiply", m.selected && "ring-2 ring-foreground")}
              />
            ))}
          {!rendering &&
            circles.map(({ m, s, i }) => (
              <FindingNumber
                key={m.key}
                n={m.number}
                priority={m.priority}
                className="pointer-events-none absolute size-5 text-[0.6875rem] shadow-card"
                style={{ left: s.x * scale - 24 - i * 18, top: s.y * scale + (s.height * scale) / 2 - 10 }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

/** Fixture mode (no PDF): the page text set as a document, every cited range marked in its finding's colour. */
function TextPage({ page, zoom, marks }: { page: LeasePage | undefined; zoom: number; marks: ViewerMark[] }) {
  const wellRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLElement>(null);
  const text = page?.text ?? "";

  // Split the text at every mark boundary; each piece is owned by its winning mark (if any).
  const cuts = [...new Set([0, text.length, ...marks.flatMap((m) => [m.start, m.end])])]
    .filter((x) => x >= 0 && x <= text.length)
    .sort((a, b) => a - b);
  const pieces: { from: number; to: number; owner?: ViewerMark }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const from = cuts[i];
    const to = cuts[i + 1];
    let owner: ViewerMark | undefined;
    for (const m of marks) if (m.start <= from && m.end >= to && wins(m, owner)) owner = m;
    pieces.push({ from, to, owner });
  }
  const firstSelected = pieces.find((p) => p.owner?.selected)?.from;

  useEffect(() => {
    // Scroll only the viewer, never the page around it.
    const well = wellRef.current;
    const mark = selectedRef.current;
    if (!well || !mark) return;
    const top = mark.getBoundingClientRect().top - well.getBoundingClientRect().top + well.scrollTop;
    well.scrollTo({ top: Math.max(0, top - well.clientHeight / 3), behavior: "smooth" });
  }, [firstSelected, page?.pageNumber]);

  return (
    <div ref={wellRef} className="min-h-0 flex-1 overflow-auto bg-background p-4 sm:p-8">
      <div
        className={cn(
          "mx-auto min-h-full max-w-[42rem] rounded-sm bg-card px-6 py-9 leading-[1.75] whitespace-pre-wrap text-foreground shadow-card sm:px-14 sm:py-14",
          SERIF,
        )}
        style={{ fontSize: `${(17.5 * zoom) / 100}px` }}
      >
        {pieces.map((p) => {
          const t = text.slice(p.from, p.to);
          // Every finding whose cited range starts here gets its number, even where another finding's colour wins.
          const starting = marks.filter((m) => m.start === p.from && m.end > m.start);
          const numbers = starting.length > 0 && (
            <span className="mr-1 inline-flex gap-0.5 align-[0.15em]">
              {[...new Map(starting.map((m) => [m.number, m])).values()].map((m) => (
                <FindingNumber
                  key={m.key}
                  n={m.number}
                  priority={m.priority}
                  className="size-5 font-sans text-[0.6875rem] leading-none ring-foreground/40"
                />
              ))}
            </span>
          );
          if (!p.owner) {
            return (
              <span key={p.from}>
                {numbers}
                {t}
              </span>
            );
          }
          const isFirstSelected = p.owner.selected && p.from === firstSelected;
          return (
            <span key={p.from}>
              {numbers}
              <mark
                ref={isFirstSelected ? selectedRef : undefined}
                style={highlighterStyle(p.owner.priority)}
                className={cn("rounded-xs bg-highlight box-decoration-clone px-0.5 text-foreground", p.owner.selected && "ring-2 ring-foreground")}
              >
                {t}
              </mark>
            </span>
          );
        })}
      </div>
    </div>
  );
}

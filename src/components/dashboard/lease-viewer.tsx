"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import type { LeaseDocument, LeasePage, TextSpan } from "@/types/lease";
import { spansForRange } from "@/lib/pdf/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** The clause to highlight: a character range on one page, straight from a finding's evidence. */
export interface HighlightTarget {
  pageNumber: number;
  start: number;
  end: number;
}

interface Props {
  pdf: PDFDocumentProxy | null;
  document: LeaseDocument;
  page: number;
  onPageChange: (page: number) => void;
  highlight: HighlightTarget | null;
  /** A finding is selected (so "nothing highlighted" needs explaining). */
  findingSelected: boolean;
}

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

export const LeaseViewer = forwardRef<HTMLElement, Props>(function LeaseViewer(
  { pdf, document, page, onPageChange, highlight, findingSelected },
  ref,
) {
  const [zoom, setZoom] = useState(100);
  const pageData = document.pages[page - 1];
  const onThisPage = highlight && highlight.pageNumber === page ? highlight : null;
  // PDF: only positioned spans from PDF.js. Text view: the exact recorded character range.
  const rects = pdf && onThisPage && pageData ? spansForRange(pageData, onThisPage.start, onThisPage.end) : [];
  const drawn = Boolean(onThisPage && (pdf ? rects.length > 0 : true));
  const noPosition = findingSelected && (!highlight || Boolean(pdf && onThisPage && rects.length === 0));

  return (
    <aside
      ref={ref}
      data-print-hide
      aria-label="Lease viewer"
      className="flex h-[min(80vh,980px)] min-w-0 flex-[1_1_460px] scroll-mt-4 flex-col overflow-hidden rounded-lg border bg-card lg:sticky lg:top-4"
    >
      <div className="flex flex-wrap items-center gap-2 border-b bg-background/60 px-3 py-2">
        <Button variant="outline" size="icon" className="size-10 bg-card" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="min-w-24 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          Page {page} of {document.pageCount}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-10 bg-card"
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
            className="size-10 bg-card"
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
            className="size-10 bg-card"
            aria-label="Zoom in"
            disabled={zoom >= ZOOM_MAX}
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>
      {noPosition && (
        <p className="border-b bg-priority-info-soft px-3.5 py-2.5 text-sm text-foreground/80">
          This finding isn’t tied to a spot in the PDF, so nothing is highlighted.
        </p>
      )}
      {pdf ? (
        <PdfPage pdf={pdf} page={page} zoom={zoom} rects={rects} />
      ) : (
        <TextPage page={pageData} zoom={zoom} highlight={onThisPage} />
      )}
      {drawn && (
        <p className="border-t bg-card px-3.5 py-1.5 text-xs text-muted-foreground">Highlighted: the lines containing the cited clause.</p>
      )}
    </aside>
  );
});

function PdfPage({ pdf, page, zoom, rects }: { pdf: PDFDocumentProxy; page: number; zoom: number; rects: TextSpan[] }) {
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

  const firstTop = rects.length ? Math.min(...rects.map((r) => r.y)) : null;
  useEffect(() => {
    if (rendering || firstTop === null || !wellRef.current) return;
    wellRef.current.scrollTo({ top: Math.max(0, firstTop * scale - 80), behavior: "smooth" });
  }, [rendering, firstTop, scale]);

  return (
    <div ref={wellRef} className="min-h-0 flex-1 overflow-auto bg-muted p-3 sm:p-6">
      <div ref={sizerRef} className="w-full">
        <div className="relative mx-auto w-fit bg-card shadow-card">
          {rendering && <Skeleton className="absolute inset-0 rounded-none" />}
          <canvas ref={canvasRef} className="block" role="img" aria-label={`Lease page ${page}`} />
          {!rendering &&
            rects.map((r, i) => (
              <div
                key={i}
                aria-hidden="true"
                className="pointer-events-none absolute rounded-xs bg-highlight ring-2 ring-highlight-border"
                style={{ left: r.x * scale - 2, top: r.y * scale - 1, width: r.width * scale + 4, height: r.height * scale + 2 }}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

/** Fixture mode (no PDF): the page text set as a document, with the cited range marked. */
function TextPage({ page, zoom, highlight }: { page: LeasePage | undefined; zoom: number; highlight: HighlightTarget | null }) {
  const wellRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement>(null);
  const text = page?.text ?? "";
  useEffect(() => {
    // Scroll only the viewer, never the page around it.
    const well = wellRef.current;
    const mark = markRef.current;
    if (!well || !mark) return;
    const top = mark.getBoundingClientRect().top - well.getBoundingClientRect().top + well.scrollTop;
    well.scrollTo({ top: Math.max(0, top - well.clientHeight / 3), behavior: "smooth" });
  }, [highlight?.start, highlight?.pageNumber]);

  return (
    <div ref={wellRef} className="min-h-0 flex-1 overflow-auto bg-muted p-3 sm:p-6">
      <div
        className="mx-auto min-h-full max-w-[40rem] bg-card px-6 py-8 font-serif leading-[1.65] whitespace-pre-wrap text-foreground shadow-card sm:px-11 sm:py-12"
        style={{ fontSize: `${(15 * zoom) / 100}px` }}
      >
        {highlight ? (
          <>
            {text.slice(0, highlight.start)}
            <mark ref={markRef} className="rounded-xs bg-highlight box-decoration-clone text-foreground ring-2 ring-highlight-border">
              {text.slice(highlight.start, highlight.end)}
            </mark>
            {text.slice(highlight.end)}
          </>
        ) : (
          text
        )}
      </div>
    </div>
  );
}

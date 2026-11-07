"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Info, Minus, Plus } from "lucide-react";
import type { LeaseDocument } from "@/types/lease";
import { spansForRange } from "@/lib/pdf/layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface HighlightTarget {
  pageNumber: number;
  start: number;
  end: number;
}

interface Props {
  pdf: PDFDocumentProxy;
  document: LeaseDocument;
  page: number;
  onPageChange: (page: number) => void;
  highlight: HighlightTarget | null;
}

/**
 * Renders one PDF page to a canvas and overlays highlight boxes over the text
 * spans that make up the cited clause. Boxes come from PDF.js text positions,
 * so they cover the actual lines of the clause (whole lines, never guessed).
 */
export function PdfViewer({ pdf, document, page, onPageChange, highlight }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rendering, setRendering] = useState(true);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
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
      const s = (width / base.width) * zoom;
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

  const pageData = document.pages[page - 1];
  const rects = highlight && highlight.pageNumber === page && pageData ? spansForRange(pageData, highlight.start, highlight.end) : [];
  const missingPosition = Boolean(highlight && highlight.pageNumber === page && rects.length === 0);

  useEffect(() => {
    if (rendering || !rects.length || !scrollRef.current) return;
    const top = Math.min(...rects.map((r) => r.y)) * scale;
    scrollRef.current.scrollTo({ top: Math.max(0, top - 80), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendering, highlight?.start, highlight?.pageNumber, scale]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-20 text-center text-sm tabular-nums" aria-live="polite">
            Page {page} of {document.pageCount}
          </span>
          <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={page >= document.pageCount} onClick={() => onPageChange(page + 1)}>
            <ChevronRight />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Zoom out" disabled={zoom <= 0.75} onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}>
            <Minus />
          </Button>
          <span className="w-10 text-center text-xs text-muted-foreground tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon-sm" aria-label="Zoom in" disabled={zoom >= 2} onClick={() => setZoom((z) => Math.min(2, z + 0.25))}>
            <Plus />
          </Button>
        </div>
      </div>
      {missingPosition && (
        <div className="flex items-start gap-2 border-b bg-warning-soft px-3 py-2 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          The exact position of this clause could not be located on the page. See the excerpt in the finding instead.
        </div>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-muted/60 p-3">
        <div ref={containerRef} className="mx-auto w-full">
          <div className="relative mx-auto w-fit bg-white shadow-card">
            {rendering && <Skeleton className="absolute inset-0 rounded-none" />}
            <canvas ref={canvasRef} className="block" aria-label={`Lease page ${page}`} role="img" />
            {!rendering &&
              rects.map((r, i) => (
                <div
                  key={i}
                  className="pointer-events-none absolute rounded-[2px] bg-highlight ring-1 ring-highlight-border/70"
                  style={{ left: r.x * scale - 2, top: r.y * scale - 1, width: r.width * scale + 4, height: r.height * scale }}
                />
              ))}
          </div>
        </div>
      </div>
      {highlight && highlight.pageNumber === page && rects.length > 0 && (
        <p className="border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
          Highlighted: the lines containing the cited clause.
        </p>
      )}
    </div>
  );
}

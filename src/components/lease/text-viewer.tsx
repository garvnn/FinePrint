"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LeaseDocument } from "@/types/lease";
import { Button } from "@/components/ui/button";
import type { HighlightTarget } from "./pdf-viewer";

/** Fallback viewer for fixture mode (no PDF): shows extracted page text with the clause marked. */
export function TextViewer({
  document,
  page,
  onPageChange,
  highlight,
}: {
  document: LeaseDocument;
  page: number;
  onPageChange: (p: number) => void;
  highlight: HighlightTarget | null;
}) {
  const markRef = useRef<HTMLElement>(null);
  const text = document.pages[page - 1]?.text ?? "";
  const h = highlight && highlight.pageNumber === page ? highlight : null;

  useEffect(() => {
    markRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [h?.start, page]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft />
          </Button>
          <span className="min-w-20 text-center text-sm tabular-nums">Page {page} of {document.pageCount}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={page >= document.pageCount} onClick={() => onPageChange(page + 1)}>
            <ChevronRight />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">Extracted text view</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-muted/60 p-3">
        <div className="mx-auto max-w-prose rounded-sm bg-white p-6 font-mono text-[0.8rem] leading-relaxed whitespace-pre-wrap shadow-card">
          {h ? (
            <>
              {text.slice(0, h.start)}
              <mark ref={markRef} className="rounded-sm bg-highlight ring-1 ring-highlight-border/70">
                {text.slice(h.start, h.end)}
              </mark>
              {text.slice(h.end)}
            </>
          ) : (
            text
          )}
        </div>
      </div>
    </div>
  );
}

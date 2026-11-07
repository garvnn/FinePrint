import type { LeasePage, TextSpan } from "@/types/lease";

/** Minimal shape of a PDF.js TextItem that we rely on. */
export interface RawTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

/**
 * Build a LeasePage from PDF.js text items. Pure and deterministic, so the
 * same function runs in the browser and in Node tests.
 *
 * - Items on a new baseline start a new line ("\n"); larger vertical gaps
 *   produce a blank line ("\n\n") which the segmenter treats as a paragraph break.
 * - Every non-empty item becomes a TextSpan with its character offsets and a
 *   top-left-origin bounding box, enabling clause highlighting on the canvas.
 */
export function buildPageFromItems(
  pageNumber: number,
  items: RawTextItem[],
  pageWidth: number,
  pageHeight: number,
): LeasePage {
  let text = "";
  const spans: TextSpan[] = [];
  let prev: { x2: number; y: number; h: number } | null = null;
  let pendingEOL = false;

  for (const item of items) {
    const str = item.str ?? "";
    const [, , , , x = 0, yBase = 0] = item.transform ?? [];
    const h = Math.abs(item.height) || Math.abs(item.transform?.[3] ?? 0) || 10;
    if (str.length === 0) {
      if (item.hasEOL) pendingEOL = true;
      continue;
    }
    if (prev) {
      const dy = Math.abs(yBase - prev.y);
      if (dy > h * 1.9) {
        text = text.replace(/[ \t]+$/, "") + "\n\n";
      } else if (dy > h * 0.5 || pendingEOL) {
        text = text.replace(/[ \t]+$/, "") + "\n";
      } else if (!/\s$/.test(text) && !/^\s/.test(str) && x > prev.x2 + 0.5) {
        text += " ";
      }
    }
    pendingEOL = false;
    const start = text.length;
    text += str;
    spans.push({
      start,
      end: text.length,
      x,
      y: pageHeight - yBase - h,
      width: item.width,
      height: h * 1.2,
    });
    prev = { x2: x + item.width, y: yBase, h };
    if (item.hasEOL) pendingEOL = true;
  }

  return { pageNumber, text, spans, width: pageWidth, height: pageHeight };
}

/** Build a page from plain text (fixture/preview mode — no coordinates). */
export function buildPageFromText(pageNumber: number, text: string): LeasePage {
  return { pageNumber, text, spans: [], width: 612, height: 792 };
}

/** Heuristic: does this set of pages contain real extractable text? */
export function hasMeaningfulText(pages: LeasePage[]): boolean {
  const letters = pages.reduce((n, p) => n + (p.text.match(/[A-Za-z]/g)?.length ?? 0), 0);
  return letters >= 80;
}

/** Spans overlapping a character range — used for highlighting. */
export function spansForRange(page: LeasePage, start: number, end: number): TextSpan[] {
  return page.spans.filter((s) => s.end > start && s.start < end);
}

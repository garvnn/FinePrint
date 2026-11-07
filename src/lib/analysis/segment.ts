import type { LeaseClause, LeasePage } from "@/types/lease";

const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "st", "no", "sec", "inc", "ave", "apt", "c", "l", "g", "m", "jr", "sr", "co", "corp", "e.g", "i.e", "u.s", "etc", "vs", "approx", "mass", "gen",
]);

const HEADING_ALLCAPS = /^\s*(?:(?:section|article)\s+)?(?:\d{1,2}(?:\.\d{1,2})*\.?\s+)?[A-Z][A-Z0-9 ,&'’/()-]{2,70}[.:]?\s*$/;
const HEADING_NUMBERED = /^\s*(?:(?:section|article)\s+)?\d{1,2}(?:\.\d{1,2})*\.?\s+[A-Z][A-Za-z'’ /&-]{2,48}[.:]?\s*$/;

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 72) return false;
  if (HEADING_ALLCAPS.test(t) && /[A-Z]{3,}/.test(t)) return true;
  if (HEADING_NUMBERED.test(t) && t.split(/\s+/).length <= 7 && !/[.;,]\s*\S/.test(t)) return true;
  return false;
}

/**
 * Split a page into sentence-level clauses, preserving page offsets.
 * Headings (ALL CAPS lines or short numbered titles) are tracked as context
 * rather than emitted as clauses.
 */
export function segmentPage(page: LeasePage): LeaseClause[] {
  const text = page.text;
  const clauses: LeaseClause[] = [];
  let heading: string | undefined;

  // 1. Paragraph blocks: separated by blank lines or heading lines.
  const blocks: { start: number; end: number; heading?: string }[] = [];
  let blockStart: number | null = null;
  let offset = 0;
  const lines = text.split("\n");
  for (const line of lines) {
    const lineStart = offset;
    const lineEnd = offset + line.length;
    offset = lineEnd + 1;
    if (line.trim() === "") {
      if (blockStart !== null) blocks.push({ start: blockStart, end: lineStart, heading });
      blockStart = null;
      continue;
    }
    if (isHeadingLine(line)) {
      if (blockStart !== null) blocks.push({ start: blockStart, end: lineStart, heading });
      blockStart = null;
      heading = line.trim().replace(/[.:]$/, "");
      continue;
    }
    // A numbered list item starting a line also starts a new block.
    if (blockStart !== null && /^\s*(?:\d{1,2}\.|\([a-z0-9]{1,3}\))\s+[A-Z]/.test(line)) {
      blocks.push({ start: blockStart, end: lineStart, heading });
      blockStart = null;
    }
    if (blockStart === null) blockStart = lineStart;
  }
  if (blockStart !== null) blocks.push({ start: blockStart, end: text.length, heading });

  // 2. Sentences within blocks.
  for (const block of blocks) {
    const segment = text.slice(block.start, block.end);
    let sentStart = 0;
    const boundary = /[.!?]["'’”)\]]?\s+(?=["'“(]?[A-Z])/g;
    for (const m of segment.matchAll(boundary)) {
      const cut = m.index! + 1;
      const before = segment.slice(sentStart, m.index!);
      const lastToken = (before.match(/([A-Za-z.]+)$/)?.[1] ?? "").toLowerCase();
      if (ABBREVIATIONS.has(lastToken.replace(/\.$/, ""))) continue;
      // List numbering like "4." or "(b)" at the start of the sentence is not a boundary.
      if (/^\s*\(?[0-9a-z]{1,3}(?:\.\d+)*$/i.test(before)) continue;
      pushClause(block.start + sentStart, block.start + cut, block.heading);
      sentStart = m.index! + m[0].length;
    }
    pushClause(block.start + sentStart, block.end, block.heading);
  }

  function pushClause(start: number, end: number, h?: string) {
    // Trim whitespace while keeping offsets exact.
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (end - start < 3) return;
    const raw = text.slice(start, end);
    clauses.push({
      id: `p${page.pageNumber}-c${clauses.length + 1}`,
      pageNumber: page.pageNumber,
      start,
      end,
      text: raw.replace(/\s+/g, " "),
      heading: h,
    });
  }

  return clauses;
}

export function segmentDocument(pages: LeasePage[]): LeaseClause[] {
  return pages.flatMap(segmentPage);
}

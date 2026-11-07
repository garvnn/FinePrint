import type { LeaseDocument } from "@/types/lease";
import { buildPageFromText } from "@/lib/pdf/layout";
import { analyzeLease } from "@/lib/analysis/analyze";

/** Build a LeaseDocument from plain-text pages (one string per page). */
export function textDoc(...pages: string[]): LeaseDocument {
  return {
    id: "t",
    fileName: "test.pdf",
    source: "fixture",
    pageCount: pages.length,
    pages: pages.map((t, i) => buildPageFromText(i + 1, t)),
    hasExtractableText: true,
  };
}

export function analyzeText(...pages: string[]) {
  return analyzeLease(textDoc(...pages));
}

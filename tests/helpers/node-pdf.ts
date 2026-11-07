/** Test helper: parse a PDF in Node with the same layout builder the browser uses. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LeaseDocument } from "@/types/lease";
import { buildPageFromItems, hasMeaningfulText, type RawTextItem } from "@/lib/pdf/layout";

export async function loadPdfInNode(path: string): Promise<LeaseDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(readFileSync(path));
  const task = pdfjs.getDocument({ data, useSystemFonts: false, verbosity: 0 });
  const pdf = await task.promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter((i) => "str" in i) as unknown as RawTextItem[];
    pages.push(buildPageFromItems(n, items, vp.width, vp.height));
  }
  await task.destroy();
  return {
    id: "test",
    fileName: path.split("/").pop() ?? "test.pdf",
    source: "sample",
    pageCount: pages.length,
    pages,
    hasExtractableText: hasMeaningfulText(pages),
  };
}

export const ROOT = join(__dirname, "..", "..");
export const SAMPLE_A_PATH = join(ROOT, "public", "samples", "fineprint-sample-lease-a.pdf");
export const SAMPLE_B_PATH = join(ROOT, "public", "samples", "fineprint-sample-lease-b.pdf");
export const FIXTURE = (name: string) => join(ROOT, "tests", "fixtures", name);

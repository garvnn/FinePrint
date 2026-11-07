/**
 * Browser-only PDF loading via PDF.js. The file's bytes are read with the
 * File API and handed to a same-origin Web Worker. Nothing is uploaded.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { LeaseDocument, LeasePage, LeaseSource } from "@/types/lease";
import { buildPageFromItems, hasMeaningfulText, type RawTextItem } from "./layout";

export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_PDF_PAGES = 60;

export class PdfLoadError extends Error {
  constructor(
    public code: "not_pdf" | "too_large" | "too_many_pages" | "corrupt" | "encrypted" | "empty",
    message: string,
  ) {
    super(message);
  }
}

/** Validate a File before reading it. Pure apart from reading the header bytes. */
export async function validatePdfFile(file: File): Promise<void> {
  const looksPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksPdf) throw new PdfLoadError("not_pdf", "That file is not a PDF. Please choose a .pdf lease document.");
  if (file.size === 0) throw new PdfLoadError("empty", "That PDF is empty (0 bytes).");
  if (file.size > MAX_PDF_BYTES) {
    throw new PdfLoadError("too_large", `That PDF is larger than ${MAX_PDF_BYTES / 1024 / 1024} MB. Please use a smaller file.`);
  }
  const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const headerText = String.fromCharCode(...header);
  if (!headerText.includes("%PDF-")) {
    throw new PdfLoadError("not_pdf", "That file does not look like a valid PDF (missing PDF header).");
  }
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      return m;
    });
  }
  return pdfjsPromise;
}

export interface LoadedPdf {
  document: LeaseDocument;
  pdf: PDFDocumentProxy;
}

export async function loadPdfFromBytes(
  bytes: ArrayBuffer,
  fileName: string,
  source: LeaseSource,
  onProgress?: (done: number, total: number) => void,
): Promise<LoadedPdf> {
  const pdfjs = await getPdfjs();
  let pdf: PDFDocumentProxy;
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
  });
  try {
    pdf = await task.promise;
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "PasswordException") {
      throw new PdfLoadError("encrypted", "This PDF is password-protected. Remove the password and try again.");
    }
    throw new PdfLoadError("corrupt", "This PDF could not be read. It may be damaged or not a real PDF.");
  }
  if (pdf.numPages > MAX_PDF_PAGES) {
    await task.destroy();
    throw new PdfLoadError("too_many_pages", `This PDF has ${pdf.numPages} pages. FinePrint supports up to ${MAX_PDF_PAGES}.`);
  }

  const pages: LeasePage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter((i): i is RawTextItem & typeof i => "str" in i) as unknown as RawTextItem[];
    pages.push(buildPageFromItems(n, items, viewport.width, viewport.height));
    onProgress?.(n, pdf.numPages);
  }

  return {
    pdf,
    document: {
      id: `doc-${Date.now().toString(36)}`,
      fileName,
      source,
      pageCount: pdf.numPages,
      pages,
      hasExtractableText: hasMeaningfulText(pages),
    },
  };
}

export async function loadPdfFromFile(file: File, onProgress?: (d: number, t: number) => void): Promise<LoadedPdf> {
  await validatePdfFile(file);
  const bytes = await file.arrayBuffer();
  return loadPdfFromBytes(bytes, file.name, "upload", onProgress);
}

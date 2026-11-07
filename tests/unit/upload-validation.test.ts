import { describe, expect, it } from "vitest";
import { MAX_PDF_BYTES, PdfLoadError, validatePdfFile } from "@/lib/pdf/load";

const pdfHeader = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n");

describe("validatePdfFile", () => {
  it("accepts a file with a PDF header", async () => {
    await expect(validatePdfFile(new File([pdfHeader], "lease.pdf", { type: "application/pdf" }))).resolves.toBeUndefined();
  });
  it("rejects non-PDF types", async () => {
    await expect(validatePdfFile(new File(["hello"], "lease.docx", { type: "application/msword" }))).rejects.toMatchObject({ code: "not_pdf" });
  });
  it("rejects a .pdf without a PDF header", async () => {
    await expect(validatePdfFile(new File(["plain text"], "fake.pdf", { type: "application/pdf" }))).rejects.toMatchObject({ code: "not_pdf" });
  });
  it("rejects empty files", async () => {
    await expect(validatePdfFile(new File([], "empty.pdf", { type: "application/pdf" }))).rejects.toMatchObject({ code: "empty" });
  });
  it("rejects files over the size limit", async () => {
    const big = new File([pdfHeader, new Uint8Array(MAX_PDF_BYTES)], "big.pdf", { type: "application/pdf" });
    const err = await validatePdfFile(big).catch((e) => e);
    expect(err).toBeInstanceOf(PdfLoadError);
    expect(err.code).toBe("too_large");
  });
});

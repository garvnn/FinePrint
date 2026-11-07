/**
 * Renders the fictional sample leases (src/lib/fixtures/sample-leases.ts)
 * into real PDFs under public/samples/, plus edge-case PDFs for tests.
 *
 *   npm run samples
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { SAMPLE_A, SAMPLE_B, type SampleLease } from "../src/lib/fixtures/sample-leases";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 72;
const BODY_SIZE = 10.5;
const LINE = 15;

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > width && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function renderLease(sample: SampleLease): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${sample.title} (fictional sample)`);
  doc.setAuthor("FinePrint demo fixtures");
  doc.setSubject("Fictional Massachusetts residential lease for demonstration");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = PAGE_W - MARGIN * 2;
  const ink = rgb(0.1, 0.12, 0.18);

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 20) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };
  const draw = (text: string, font: PDFFont, size: number, opts: { center?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
    const x = opts.center ? (PAGE_W - font.widthOfTextAtSize(text, size)) / 2 : MARGIN;
    page.drawText(text, { x, y, size, font, color: opts.color ?? ink });
  };

  draw(sample.title, bold, 15, { center: true });
  y -= 20;
  draw(sample.subtitle, bold, 8.5, { center: true, color: rgb(0.7, 0.1, 0.1) });
  y -= 28;

  for (const p of sample.preamble) {
    for (const l of wrap(p, regular, BODY_SIZE, width)) {
      ensure(LINE);
      draw(l, regular, BODY_SIZE);
      y -= LINE;
    }
    y -= 8;
  }
  y -= 6;

  for (const section of sample.sections) {
    const firstLines = wrap(section.paragraphs[0] ?? "", regular, BODY_SIZE, width).length;
    ensure(LINE * (2 + Math.min(firstLines, 3)));
    draw(section.heading, bold, 11);
    y -= LINE + 2;
    for (const para of section.paragraphs) {
      for (const l of wrap(para, regular, BODY_SIZE, width)) {
        ensure(LINE);
        draw(l, regular, BODY_SIZE);
        y -= LINE;
      }
      y -= 8;
    }
    y -= 6;
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawText(`Fictional sample - Page ${i + 1} of ${pages.length}`, {
      x: MARGIN,
      y: 40,
      size: 8,
      font: regular,
      color: rgb(0.45, 0.47, 0.52),
    });
  });
  return doc.save();
}

/** A "scanned" PDF: drawn shapes only, no text layer. */
async function renderScanned(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  for (let i = 0; i < 30; i++) {
    page.drawRectangle({ x: MARGIN, y: PAGE_H - MARGIN - i * 18, width: 300 + ((i * 37) % 160), height: 6, color: rgb(0.3, 0.3, 0.3) });
  }
  return doc.save();
}

async function renderNoRent(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const lines = [
    "RENTAL AGREEMENT (FICTIONAL TEST DOCUMENT)",
    "This agreement is between a fictional landlord and a fictional tenant for an apartment in Massachusetts.",
    "Tenant agrees to keep the premises clean and to report problems promptly.",
    "Rent amount will be set out in a separate schedule to be provided later.",
  ];
  lines.forEach((l, i) => page.drawText(l, { x: MARGIN, y: PAGE_H - MARGIN - i * 18, size: 10.5, font }));
  return doc.save();
}

async function main() {
  const publicDir = join(process.cwd(), "public", "samples");
  const testDir = join(process.cwd(), "tests", "fixtures");
  mkdirSync(publicDir, { recursive: true });
  mkdirSync(testDir, { recursive: true });
  for (const s of [SAMPLE_A, SAMPLE_B]) {
    const bytes = await renderLease(s);
    writeFileSync(join(publicDir, s.fileName), bytes);
    console.log(`wrote public/samples/${s.fileName} (${bytes.length} bytes)`);
  }
  writeFileSync(join(testDir, "scanned.pdf"), await renderScanned());
  writeFileSync(join(testDir, "no-rent.pdf"), await renderNoRent());
  writeFileSync(join(testDir, "not-a-pdf.pdf"), "This is plain text pretending to be a PDF.\n");
  writeFileSync(join(testDir, "empty.pdf"), "");
  console.log("wrote tests/fixtures edge-case PDFs");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

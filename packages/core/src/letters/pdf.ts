/**
 * Letter → PDF in the browser (pdf-lib, loaded on demand): the letterhead PDF is drawn as the
 * background of every page, the text flows inside the template margins and continues on new pages.
 */
import type { PDFFont, PDFPage, PDFEmbeddedPage } from "pdf-lib";
import type { LetterTemplate, LetterValue } from "./data";
import { tr } from "../i18n/i18n";

const MM = 72 / 25.4;
const A4 = { w: 595.28, h: 841.89 };
const INK = { r: 0.12, g: 0.14, b: 0.18 };
const GREY = { r: 0.45, g: 0.48, b: 0.54 };

type Run = { text: string; bold: boolean };

/** Characters the standard PDF fonts can't draw, replaced with close equivalents. */
const SUBST: Record<string, string> = { "→": "->", "←": "<-", "≥": ">=", "≤": "<=", "✓": "v", " ": " ", "\t": "    " };

async function loadBytes(src: string) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(tr("Carta intestata non trovata ({0})", [res.status]));
  return new Uint8Array(await res.arrayBuffer());
}

/** Splits "a **b** c" into runs. */
function runsOf(text: string): Run[] {
  const out: Run[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
    if (!part) return;
    const bold = part.startsWith("**") && part.endsWith("**") && part.length > 4;
    out.push({ text: bold ? part.slice(2, -2) : part, bold });
  });
  return out;
}

const fill = (line: string, values: Record<string, LetterValue>) =>
  line.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (whole, key: string) => {
    const v = values[key];
    if (v == null) return whole; // unknown: stays visible, so the author notices
    return typeof v === "string" ? v : v.rows.map((r) => r.join(" ")).join("; ");
  });

export async function renderLetter(t: LetterTemplate, values: Record<string, LetterValue>): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(t.name);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // the first page of each letterhead PDF becomes a background
  const embed = async (src?: string) => {
    if (!src) return undefined;
    const [page] = await doc.embedPdf(await loadBytes(src), [0]);
    return page;
  };
  const bgFirst = await embed(t.letterhead?.first);
  const bgNext = t.letterhead?.next && t.letterhead.next !== t.letterhead.first ? await embed(t.letterhead.next) : bgFirst;

  // replace what the fonts can't encode (WinAnsi), char by char, cached
  const okChar = new Map<string, boolean>();
  const safe = (s: string) =>
    [...s]
      .map((c) => {
        if (SUBST[c] != null) return SUBST[c];
        if (!okChar.has(c)) {
          try {
            regular.encodeText(c);
            okChar.set(c, true);
          } catch {
            okChar.set(c, false);
          }
        }
        return okChar.get(c) ? c : "?";
      })
      .join("");

  const size = t.fontSize || 10.5;
  const lh = size * 1.45;
  const m = t.margins;
  const left = m.left * MM;
  const right = A4.w - m.right * MM;
  const width = right - left;
  const bottom = m.bottom * MM;

  let page!: PDFPage;
  let y = 0;
  let pages = 0;
  const newPage = () => {
    page = doc.addPage([A4.w, A4.h]);
    const bg: PDFEmbeddedPage | undefined = pages === 0 ? bgFirst : bgNext;
    if (bg) page.drawPage(bg, { x: 0, y: 0, width: A4.w, height: A4.h });
    y = A4.h - (pages === 0 ? m.top : (m.topNext ?? m.top)) * MM;
    pages++;
  };
  const ensure = (h: number) => {
    if (y - h < bottom) newPage();
  };
  newPage();

  const fontOf = (r: Run): PDFFont => (r.bold ? bold : regular);

  /** Wraps runs into lines of at most `w` points. */
  const wrap = (runs: Run[], w: number, sz: number) => {
    const lines: Run[][] = [[]];
    let cur = 0;
    for (const r of runs) {
      for (const word of r.text.split(/(\s+)/)) {
        if (!word) continue;
        const piece = { text: safe(word), bold: r.bold };
        const pw = fontOf(piece).widthOfTextAtSize(piece.text, sz);
        const space = /^\s+$/.test(word);
        if (cur + pw > w && cur > 0 && !space) {
          lines.push([]);
          cur = 0;
        }
        if (space && cur === 0) continue;
        lines[lines.length - 1].push(piece);
        cur += pw;
      }
    }
    return lines;
  };

  const drawLine = (line: Run[], x: number, yy: number, sz: number, color = INK) => {
    let cx = x;
    for (const r of line) {
      const f = fontOf(r);
      page.drawText(r.text, { x: cx, y: yy, size: sz, font: f, color: rgb(color.r, color.g, color.b) });
      cx += f.widthOfTextAtSize(r.text, sz);
    }
  };

  const drawTable = (tb: Exclude<LetterValue, string>) => {
    const sz = size - 1;
    const pad = 4;
    const tlh = sz * 1.35;
    const total = tb.widths?.reduce((a, b) => a + b, 0) ?? tb.head.length;
    const cols = tb.head.map((_, i) => ((tb.widths?.[i] ?? 1) / total) * width);
    const line = rgb(0.82, 0.84, 0.88);

    const rowHeight = (cells: string[], isHead: boolean) =>
      Math.max(...cells.map((c, i) => wrap([{ text: c, bold: isHead }], cols[i] - pad * 2, sz).length)) * tlh + pad * 2;

    const drawRow = (cells: string[], isHead: boolean) => {
      const h = rowHeight(cells, isHead);
      if (y - h < bottom) {
        newPage();
        if (!isHead) drawRow(tb.head, true); // repeat the header on the new page
      }
      if (isHead) page.drawRectangle({ x: left, y: y - h, width, height: h, color: rgb(0.95, 0.96, 0.97) });
      let x = left;
      cells.forEach((c, i) => {
        const lines = wrap([{ text: c, bold: isHead }], cols[i] - pad * 2, sz);
        lines.forEach((l, k) => drawLine(l, x + pad, y - pad - sz - k * tlh + 1, sz, isHead ? GREY : INK));
        x += cols[i];
      });
      page.drawLine({ start: { x: left, y: y - h }, end: { x: right, y: y - h }, thickness: 0.6, color: line });
      y -= h;
    };

    ensure(rowHeight(tb.head, true) * 2);
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: line });
    drawRow(tb.head, true);
    tb.rows.forEach((r) => drawRow(r, false));
    y -= lh * 0.6;
  };

  for (const raw of t.body.replace(/\r\n/g, "\n").split("\n")) {
    const only = raw.trim().match(/^\{\{\s*([a-z0-9_]+)\s*\}\}$/i);
    const v = only ? values[only[1]] : undefined;
    if (v && typeof v !== "string") {
      drawTable(v);
      continue;
    }
    if (!raw.trim()) {
      y -= lh * 0.6; // paragraph gap
      continue;
    }
    for (const l of wrap(runsOf(fill(raw, values)), width, size)) {
      ensure(lh);
      drawLine(l, left, y - size, size);
      y -= lh;
    }
  }

  return doc.save();
}

/** Opens the PDF bytes as an object URL (for an <iframe> preview or a download link). */
export const pdfUrl = (bytes: Uint8Array) => URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));

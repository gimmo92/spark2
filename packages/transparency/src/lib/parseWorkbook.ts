export type ParsedWorkbook = {
  headers: string[];
  rows: unknown[][];
  sheetName: string;
};

export class WorkbookParseError extends Error {
  code: "html" | "download" | "empty" | "read";

  constructor(code: WorkbookParseError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "WorkbookParseError";
  }
}

function cellToPrimitive(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value;
  const obj = value as {
    text?: string;
    result?: unknown;
    richText?: Array<{ text?: string }>;
    formula?: string;
    hyperlink?: string;
  };
  if (Array.isArray(obj.richText)) {
    const text = obj.richText.map((t) => t?.text ?? "").join("");
    return text || null;
  }
  if (obj.result != null) return cellToPrimitive(obj.result);
  if (typeof obj.text === "string") return obj.text;
  if (typeof obj.hyperlink === "string") return obj.hyperlink;
  return null;
}

function isNonEmptyCell(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

function isHeaderLikeRow(values: unknown[]): boolean {
  const nonEmpty = values.filter(isNonEmptyCell);
  if (nonEmpty.length < 2) return false;
  const strings = nonEmpty.filter(
    (c) => typeof c === "string" && Number.isNaN(Number(c))
  );
  const textRatio = strings.length / nonEmpty.length;
  const avgLen =
    strings.reduce<number>((s, c) => s + String(c).length, 0) / (strings.length || 1);
  return textRatio >= 0.5 && avgLen > 2;
}

function detectHeaderRow(rows: unknown[][]): number {
  const limit = Math.min(rows.length, 10);
  for (let i = 0; i < limit; i++) {
    if (isHeaderLikeRow(rows[i] || [])) return i;
  }
  return 0;
}

function sheetToMatrix(worksheet: {
  eachRow: (
    options: { includeEmpty: boolean },
    cb: (row: {
      eachCell: (
        options: { includeEmpty: boolean },
        cellCb: (cell: { value: unknown }, colNumber: number) => void
      ) => void;
    }) => void
  ) => void;
  columnCount?: number;
}): unknown[][] {
  const rows: unknown[][] = [];
  let maxCol = worksheet.columnCount || 0;

  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber > maxCol) maxCol = colNumber;
      cells[colNumber - 1] = cellToPrimitive(cell.value);
    });
    rows.push(cells);
  });

  return rows.map((row) => {
    const padded = row.slice();
    while (padded.length < maxCol) padded.push(null);
    return padded;
  });
}

function countNonEmptyDataRows(rows: unknown[][], headerRowIndex: number): number {
  return rows.slice(headerRowIndex + 1).filter((row) =>
    Array.isArray(row) && row.some(isNonEmptyCell)
  ).length;
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function looksLikeHtml(probe: string, contentType: string): boolean {
  const text = probe.trimStart().toLowerCase();
  return text.startsWith("<!doctype html") || text.startsWith("<html") || contentType.includes("text/html");
}

function detectDelimiter(text: string): "," | ";" {
  const first = text.split(/\r?\n/, 1)[0] || "";
  const commas = (first.match(/,/g) || []).length;
  const semis = (first.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

export function parseCsvText(csvText: string): ParsedWorkbook {
  const text = csvText.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      matrix.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    matrix.push(row);
  }
  if (!matrix.length) return { headers: [], rows: [], sheetName: "csv" };
  const headerRowIndex = detectHeaderRow(matrix);
  const headers = (matrix[headerRowIndex] || []).map((h) => String(h ?? "").trim());
  return {
    headers,
    rows: matrix.slice(headerRowIndex + 1),
    sheetName: "csv",
  };
}

export async function parseExcelArrayBuffer(
  arrayBuffer: ArrayBuffer,
  contentType = "",
  filename = ""
): Promise<ParsedWorkbook> {
  const bytes = new Uint8Array(arrayBuffer);
  const startsWithZip = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  const probe = decodeText(bytes.slice(0, 512));
  const type = contentType.toLowerCase();
  const name = filename.toLowerCase();
  if (looksLikeHtml(probe, type) && !startsWithZip) {
    throw new WorkbookParseError(
      "html",
      "Il link non punta al file diretto (restituisce HTML/preview). Usa un URL di download diretto del .xlsx o .csv."
    );
  }
  const forceCsv = name.endsWith(".csv") || type.includes("text/csv");
  const looksLikeCsv = probe.includes(",") || probe.includes(";");
  if (!startsWithZip && (forceCsv || looksLikeCsv || type.includes("text/plain"))) {
    return parseCsvText(decodeText(bytes));
  }
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = (ExcelJSModule as { default?: unknown }).default || ExcelJSModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workbook = new (ExcelJS as any).Workbook();
  await workbook.xlsx.load(arrayBuffer);

  let best: ParsedWorkbook & { nonEmptyDataRows: number } = {
    headers: [],
    rows: [],
    sheetName: "",
    nonEmptyDataRows: -1,
  };

  for (const worksheet of workbook.worksheets || []) {
    if (!worksheet) continue;
    const matrix = sheetToMatrix(worksheet);
    if (!matrix.length) continue;
    const headerRowIndex = detectHeaderRow(matrix);
    const headerRow = matrix[headerRowIndex] || [];
    const headers = headerRow.map((h) =>
      h == null ? "" : String(h)
    );
    const dataRows = matrix.slice(headerRowIndex + 1);
    const nonEmptyDataRows = countNonEmptyDataRows(matrix, headerRowIndex);
    if (nonEmptyDataRows > best.nonEmptyDataRows) {
      best = {
        headers,
        rows: dataRows,
        sheetName: worksheet.name || "",
        nonEmptyDataRows,
      };
    }
  }

  if (best.nonEmptyDataRows < 0) {
    return { headers: [], rows: [], sheetName: "" };
  }

  return {
    headers: best.headers,
    rows: best.rows,
    sheetName: best.sheetName,
  };
}

export async function parseExcelFromFile(file: File): Promise<ParsedWorkbook> {
  if (!file) throw new Error("Nessun file selezionato.");
  const arrayBuffer = await file.arrayBuffer();
  return parseExcelArrayBuffer(arrayBuffer, String(file.type || ""), file.name || "");
}

function filenameFromUrl(url: string, contentDisposition: string | null): string {
  const fromHeader = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(contentDisposition || "");
  if (fromHeader?.[1]) {
    try {
      return decodeURIComponent(fromHeader[1].replace(/"/g, "").trim());
    } catch {
      return fromHeader[1].replace(/"/g, "").trim();
    }
  }
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").filter(Boolean).pop();
    if (base && base.includes(".")) return decodeURIComponent(base);
  } catch {
    /* relative or invalid URL */
  }
  return "tracciato-tea.xlsx";
}

export async function parseExcelFromUrl(
  url: string
): Promise<ParsedWorkbook & { file: File }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new WorkbookParseError(
      "download",
      `Download non riuscito (${response.status})`
    );
  }
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const arrayBuffer = await response.arrayBuffer();
  const name = filenameFromUrl(url, response.headers.get("content-disposition"));
  const parsed = await parseExcelArrayBuffer(arrayBuffer, contentType, name);
  const file = new File([arrayBuffer], name, {
    type: contentType || "application/octet-stream",
  });
  return { ...parsed, file };
}

export function countNonEmptyRows(rows: unknown[][]): number {
  return (rows || []).filter(
    (row) => Array.isArray(row) && row.some(isNonEmptyCell)
  ).length;
}

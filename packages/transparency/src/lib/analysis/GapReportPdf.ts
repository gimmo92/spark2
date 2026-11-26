import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SalaryMath } from "./SalaryMath";

const MARGIN = 14;

type GapReportPayload = {
  companyName: string;
  referencePeriod: string;
  metricLabel: string;
  nEmployees: string;
  generatedAtLabel: string;
  gapMean: number | null;
  gapMedian: number | null;
  gapHourlyMean?: number | null;
  gapHourlyMedian?: number | null;
  ccnlRows: {
    ccnlLabel: string;
    levelLabel: string;
    nTotal: number;
    nM: number;
    nF: number;
    avgM: number | null;
    avgF: number | null;
    gapMean: number | null;
    insufficientSample: boolean;
    status: string;
  }[];
  quartiles: {
    quartile: number;
    totale: number;
    maschile: number;
    femminile: number;
    pctOfTotalM: number | null;
    pctOfTotalF: number | null;
    avgMaschile: number | null;
    avgFemminile: number | null;
    gapPct: number | null;
  }[];
  groupsAboveThreshold: {
    label: string;
    gapMean: number | null;
    nTotal: number;
  }[];
  includeFascia: boolean;
  fasciaRows: {
    fasciaId: string;
    fasciaLabel: string;
    levelLabel: string;
    nM: number;
    nF: number;
    gap: number | null;
    insufficientSample: boolean;
    status: string;
  }[];
  includeCostCenter: boolean;
  costCenterRows: {
    label: string;
    nTotal: number;
    nM: number;
    nF: number;
    gapMean: number | null;
    insufficientSample: boolean;
    status: string;
  }[];
  justifications?: {
    employeeId: string;
    name: string | null;
    gender?: string | null;
    deviationPct?: number | null;
    note: string;
  }[];
};

function euro(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  return `${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function gap(value: number | null): string {
  const text = SalaryMath.formatSignedGap(value);
  return text === "–" ? "-" : text;
}

const PDF_REDUCED = "n/d - campione ridotto";

function statusLabel(status: string, insufficient: boolean): string {
  if (insufficient || status === "insufficient") return PDF_REDUCED;
  if (status === "red") return "Fuori soglia";
  if (status === "yellow") return "Giustificato";
  return "In soglia";
}

function drawCover(doc: jsPDF, payload: GapReportPayload) {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Report analisi divario retributivo", pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    "Documento di supporto alla reportistica e alla documentazione interna.",
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 16;
  const lines: [string, string][] = [
    ["Ragione sociale", payload.companyName || "–"],
    ["Periodo di riferimento", payload.referencePeriod || "–"],
    ["Data generazione", payload.generatedAtLabel],
    ["Dipendenti analizzati (M/F)", payload.nEmployees],
    ["Metrica retributiva", payload.metricLabel || "–"],
    ["Normalizzazione part-time", "Sì (full-time equivalent)"],
  ];
  for (const [label, value] of lines) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), MARGIN + 62, y);
    y += 7;
  }
}

function ensure(doc: jsPDF, y: number, needed = 28) {
  if (y + needed > doc.internal.pageSize.getHeight() - MARGIN) {
    doc.addPage();
    return 18;
  }
  return y;
}

function table(doc: jsPDF, y: number, head: string[][], body: string[][]) {
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head,
    body: body.length ? body : [head[0].map(() => "–")],
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 118, 110] },
  });
  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
  return (finalY ?? y) + 8;
}

export function downloadGapReportPdf(payload: GapReportPayload) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawCover(doc, payload);
  doc.addPage();
  let y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("1. Sintesi", MARGIN, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Gap medio: ${gap(payload.gapMean)}`, MARGIN, y);
  y += 6;
  doc.text(`Gap mediano: ${gap(payload.gapMedian)}`, MARGIN, y);
  y += 6;
  doc.text(`Gap medio orario: ${gap(payload.gapHourlyMean ?? null)}`, MARGIN, y);
  y += 6;
  doc.text(`Gap mediano orario: ${gap(payload.gapHourlyMedian ?? null)}`, MARGIN, y);
  y += 10;

  y = ensure(doc, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("2. Livelli CCNL", MARGIN, y);
  y += 4;
  const multiCcnl = new Set(payload.ccnlRows.map((row) => row.ccnlLabel).filter(Boolean)).size > 1;
  y = table(
    doc,
    y,
    [multiCcnl
      ? ["CCNL", "Livello", "N", "M", "F", "Media M", "Media F", "Gap", "Stato"]
      : ["Livello", "N", "M", "F", "Media M", "Media F", "Gap", "Stato"]],
    payload.ccnlRows.map((row) => {
      const cells = [
        String(row.nTotal),
        String(row.nM),
        String(row.nF),
        row.insufficientSample ? PDF_REDUCED : euro(row.avgM),
        row.insufficientSample ? PDF_REDUCED : euro(row.avgF),
        row.insufficientSample ? PDF_REDUCED : gap(row.gapMean),
        statusLabel(row.status, row.insufficientSample),
      ];
      return multiCcnl
        ? [row.ccnlLabel || "–", row.levelLabel, ...cells]
        : [row.levelLabel, ...cells];
    })
  );

  y = ensure(doc, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("3. Quartili retributivi", MARGIN, y);
  y += 4;
  y = table(
    doc,
    y,
    [["Q", "N", "M", "F", "% M", "% F", "Media M", "Media F", "Gap"]],
    payload.quartiles.map((q) => {
      const hidePay = (q.maschile ?? 0) < 5 || (q.femminile ?? 0) < 5;
      return [
        `Q${q.quartile}`,
        String(q.totale ?? 0),
        String(q.maschile ?? 0),
        String(q.femminile ?? 0),
        q.pctOfTotalM != null ? `${q.pctOfTotalM.toFixed(1)}%` : "n/d",
        q.pctOfTotalF != null ? `${q.pctOfTotalF.toFixed(1)}%` : "n/d",
        hidePay ? PDF_REDUCED : euro(q.avgMaschile),
        hidePay ? PDF_REDUCED : euro(q.avgFemminile),
        hidePay ? PDF_REDUCED : gap(q.gapPct),
      ];
    })
  );

  y = ensure(doc, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("4. Gruppi oltre soglia", MARGIN, y);
  y += 4;
  y = table(
    doc,
    y,
    [["Gruppo", "Gap medio", "N"]],
    payload.groupsAboveThreshold.map((group) => [
      group.label,
      gap(group.gapMean),
      String(group.nTotal),
    ])
  );

  if (payload.includeFascia || payload.includeCostCenter) {
    y = ensure(doc, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("5. Analisi integrative (non normative)", MARGIN, y);
    y += 4;
  }

  if (payload.includeFascia) {
    y = table(
      doc,
      y,
      [["Fascia", "Punteggio", "Livelli", "M", "F", "Gap", "Stato"]],
      payload.fasciaRows.map((row) => [
        row.fasciaId,
        row.fasciaLabel,
        row.levelLabel,
        String(row.nM),
        String(row.nF),
        row.insufficientSample ? PDF_REDUCED : gap(row.gap),
        statusLabel(row.status, row.insufficientSample),
      ])
    );
  }

  if (payload.includeCostCenter) {
    y = table(
      doc,
      y,
      [["Centro di costo", "N", "M", "F", "Gap", "Stato"]],
      payload.costCenterRows.map((row) => [
        row.label,
        String(row.nTotal),
        String(row.nM),
        String(row.nF),
        row.insufficientSample ? PDF_REDUCED : gap(row.gapMean),
        statusLabel(row.status, row.insufficientSample),
      ])
    );
  }

  const justified = payload.justifications || [];
  if (justified.length) {
    y = ensure(doc, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Giustificativi esclusi dall'analisi", MARGIN, y);
    y += 4;
    y = table(
      doc,
      y,
      [["ID", "Nome", "Genere", "Scostamento", "Nota"]],
      justified.map((item) => [
        item.employeeId || "-",
        item.name || "-",
        item.gender || "-",
        item.deviationPct == null || !Number.isFinite(item.deviationPct)
          ? "-"
          : `${item.deviationPct > 0 ? "+" : ""}${item.deviationPct.toFixed(1)}%`,
        item.note || "-",
      ])
    );
  }

  doc.save("report-divario-retributivo.pdf");
}

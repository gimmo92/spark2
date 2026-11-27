import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Employee } from "../models/Employee";
import { MIN_GENDER_SAMPLE, SALARY_METRICS } from "../models/constants";
import { defaultRgaSelection, personPay } from "./RgaComponents";
import { LevelTaxonomy } from "./LevelTaxonomy";
import { yearsOfService } from "./RoleAnalyzer";
import { SalaryMath } from "./SalaryMath";

const MARGIN = 14;

export type PayLetterScope = "company" | "annex" | "group" | "level";

/** One pay component of the category: means and medians by gender, gaps, the requester's value. */
export interface PayLetterComponent {
  label: string;
  own: number | null;
  meanM: number | null;
  meanF: number | null;
  medianM: number | null;
  medianF: number | null;
  gapMean: number | null;
  gapMedian: number | null;
  /** Median of the whole category and the requester's deviation from it (%). */
  median: number | null;
  vsMedianPct: number | null;
}

export type PayLetterAssessment =
  | { ok: false; reason: "category" }
  | {
      ok: false;
      reason: "sample";
      scope: PayLetterScope;
      nextScope: PayLetterScope | null;
      nMen: number;
      nWomen: number;
      minPerGender: number;
    }
  | {
      ok: true;
      personName: string;
      company: string;
      levelLabel: string;
      ccnl: string;
      periodLabel: string;
      generatedAt: Date;
      ownFte: number;
      ownHourly: number | null;
      seniorityYears: number | null;
      nMen: number;
      nWomen: number;
      categorySize: number;
      avgMen: number;
      avgWomen: number;
      avgMenHourly: number | null;
      avgWomenHourly: number | null;
      gapHourlyPct: number | null;
      vsMenPct: number | null;
      vsWomenPct: number | null;
      vsMenText: string;
      vsWomenText: string;
      vsMenHourlyPct: number | null;
      vsWomenHourlyPct: number | null;
      vsMenHourlyText: string;
      vsWomenHourlyText: string;
      qualification: string;
      jobFamily: string;
      grade: string;
      payBand: string;
      educationLevel: string;
      scope: PayLetterScope;
      perimeterText: string;
      minPerGender: number;
      /** Base, variable and total pay of the category (means, medians, gender gaps). */
      components: PayLetterComponent[];
      /** Quartile of the requester's base pay in the category (1 = lowest 25%). */
      quartile: 1 | 2 | 3 | 4;
    };

function ccnlOf(person: Employee): string {
  return String(person?.ccnl || "").trim();
}

function ccnlKey(ccnl: string): string {
  return ccnl.toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ").trim();
}

/** FISE Servizi Ambientali annex A or B. Utilitalia is a different contract. */
export function environmentalAnnex(ccnl: string): boolean {
  const key = ccnlKey(ccnl);
  return key.includes("servizi ambientali") && /\ballegato\s+[ab]\b/.test(key);
}

function sameContract(left: string, right: string): boolean {
  const a = ccnlKey(left);
  const b = ccnlKey(right);
  return Boolean(a) && a === b;
}

function levelKey(levelRaw: unknown): string {
  const raw = String(levelRaw ?? "").trim();
  if (!raw) return "";
  const normalized = LevelTaxonomy.normalize(raw) || raw;
  return normalized
    .toLowerCase()
    .replace(/^(livello|liv\.?|gruppo)\s*/i, "")
    .replace(/[\s._-]+/g, "");
}

function sameLevel(left: Employee, right: Employee): boolean {
  const levelA = levelKey(left.level);
  const levelB = levelKey(right.level);
  return Boolean(levelA && levelA === levelB);
}

function sameCompany(left: Employee, right: Employee): boolean {
  const companyKey = (company: string) => company.toLowerCase().replace(/\s+/g, " ").trim();
  return companyKey(String(left.company || "")) === companyKey(String(right.company || ""));
}

function inScope(person: Employee, other: Employee, scope: PayLetterScope): boolean {
  if (!sameLevel(person, other)) return false;
  const ownCcnl = ccnlOf(person);
  const otherCcnl = ccnlOf(other);
  if (scope === "level") return true;
  if (scope === "annex") {
    return sameCompany(person, other)
      && environmentalAnnex(ownCcnl)
      && environmentalAnnex(otherCcnl);
  }
  if (scope === "group") {
    if (environmentalAnnex(ownCcnl)) return environmentalAnnex(otherCcnl);
    return sameContract(ownCcnl, otherCcnl);
  }
  if (!sameCompany(person, other)) return false;
  return sameContract(ownCcnl, otherCcnl);
}

function nextScope(ccnl: string, scope: PayLetterScope): PayLetterScope | null {
  if (scope === "level") return null;
  if (scope === "group") return "level";
  if (scope === "annex") return "group";
  return environmentalAnnex(ccnl) ? "annex" : "group";
}

export function payLetterPerimeter(scope: PayLetterScope, ccnl = ""): string {
  if (scope === "level") return "nell'ambito del gruppo, a parità di livello";
  if (scope === "group" && environmentalAnnex(ccnl)) {
    return "nell'ambito del gruppo, con gli allegati A e B insieme";
  }
  if (scope === "group") return "nell'ambito del gruppo";
  if (scope === "annex") return "della società, con gli allegati A e B insieme";
  return "della società";
}

function pay(person: Employee): number | null {
  const value = person.baseSalaryFte;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function hourly(person: Employee): number | null {
  const value = person.hourlyPay();
  return value != null && value > 0 ? value : null;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function placement(own: number, reference: number | null): { pct: number | null; text: string } {
  if (!Number.isFinite(own) || reference == null || reference <= 0) return { pct: null, text: "n/d" };
  const pct = ((own - reference) / reference) * 100;
  if (Math.abs(pct) < 0.005) {
    return { pct: 0, text: "In linea con la media di riferimento" };
  }
  const abs = Math.abs(pct).toFixed(2).replace(".", ",");
  const direction = pct < 0 ? "Sotto" : "Sopra";
  return { pct, text: `${direction} la media di riferimento del ${abs}%` };
}

export function assessPayLetter(
  person: Employee,
  peers: Employee[] = [],
  options: { now?: Date; minPerGender?: number; scope?: PayLetterScope; periodLabel?: string } = {}
): PayLetterAssessment {
  const now = options.now ?? new Date();
  const periodLabel = options.periodLabel?.trim() || `Anno ${now.getFullYear()}`;
  const minPerGender = options.minPerGender ?? MIN_GENDER_SAMPLE;
  const level = LevelTaxonomy.normalize(person?.level) || "";
  const ccnl = ccnlOf(person);
  if (!person || !level || !ccnl || pay(person) == null) {
    return { ok: false, reason: "category" };
  }

  const scope = options.scope ?? "company";
  const members = [...(peers || [])];
  if (!members.some((peer) => peer.index === person.index)) members.push(person);
  const others = members.filter(
    (peer) => peer.index !== person.index && inScope(person, peer, scope)
  );
  const nMen = others.filter((peer) => peer.gender === "M").length;
  const nWomen = others.filter((peer) => peer.gender === "F").length;
  const sameGenderOthers = others.filter((peer) => peer.gender === person.gender).length;
  const otherGender = person.gender === "M" ? nWomen : nMen;
  if (sameGenderOthers < minPerGender || otherGender < minPerGender) {
    return {
      ok: false,
      reason: "sample",
      scope,
      nextScope: nextScope(ccnl, scope),
      nMen,
      nWomen,
      minPerGender,
    };
  }

  const compared = [person, ...others];
  const men = compared.filter((peer) => peer.gender === "M").map(pay).filter((value): value is number => value != null);
  const women = compared.filter((peer) => peer.gender === "F").map(pay).filter((value): value is number => value != null);
  const avgMen = mean(men);
  const avgWomen = mean(women);
  const ownFte = pay(person) as number;
  const ownHourly = hourly(person);
  const hourlyOf = (gender: "M" | "F") =>
    mean(
      compared
        .filter((peer) => peer.gender === gender)
        .map(hourly)
        .filter((value): value is number => value != null)
    );
  const avgMenHourly = hourlyOf("M");
  const avgWomenHourly = hourlyOf("F");
  const versusMen = placement(ownFte, avgMen);
  const versusWomen = placement(ownFte, avgWomen);
  const versusMenHourly = placement(ownHourly ?? Number.NaN, avgMenHourly);
  const versusWomenHourly = placement(ownHourly ?? Number.NaN, avgWomenHourly);
  const gapHourlyPct = avgMenHourly == null || avgWomenHourly == null
    ? null
    : SalaryMath.genderPayGapPct(avgMenHourly, avgWomenHourly);

  const rga = defaultRgaSelection();
  const parts: { label: string; of: (p: Employee) => number | null }[] = [
    { label: "Retribuzione base (RAL FTE)", of: pay },
    { label: "Componenti variabili", of: (p) => personPay(p, SALARY_METRICS.variabile, rga) },
    { label: "Retribuzione totale", of: (p) => personPay(p, SALARY_METRICS.totale, rga) },
  ];
  const med = (values: number[]) => (values.length ? SalaryMath.median(values) : null);
  const components: PayLetterComponent[] = parts.map(({ label, of }) => {
    const vals = (g?: "M" | "F") =>
      compared
        .filter((peer) => !g || peer.gender === g)
        .map(of)
        .filter((value): value is number => value != null && value > 0);
    const [m, f, all] = [vals("M"), vals("F"), vals()];
    const meanM = mean(m);
    const meanF = mean(f);
    const medianM = med(m);
    const medianF = med(f);
    const median = med(all);
    const own = of(person);
    return {
      label,
      own: own != null && own > 0 ? own : null,
      meanM,
      meanF,
      medianM,
      medianF,
      gapMean: meanM != null && meanF != null ? SalaryMath.genderPayGapPct(meanM, meanF) : null,
      gapMedian: medianM != null && medianF != null ? SalaryMath.genderPayGapPct(medianM, medianF) : null,
      median,
      vsMedianPct: own != null && own > 0 && median ? ((own - median) / median) * 100 : null,
    };
  });
  const sortedBase = compared.map(pay).filter((value): value is number => value != null).sort((a, b) => a - b);
  const below = sortedBase.filter((value) => value < ownFte).length;
  const quartile = (Math.min(4, Math.floor((below / Math.max(1, sortedBase.length)) * 4) + 1) as 1 | 2 | 3 | 4);

  return {
    ok: true,
    personName: person.name || "—",
    company: person.company || "—",
    levelLabel: LevelTaxonomy.displayLabel(person.level),
    ccnl,
    periodLabel,
    generatedAt: now,
    ownFte,
    ownHourly,
    seniorityYears: yearsOfService(person, now),
    nMen: compared.filter((peer) => peer.gender === "M").length,
    nWomen: compared.filter((peer) => peer.gender === "F").length,
    categorySize: compared.length,
    avgMen: avgMen ?? 0,
    avgWomen: avgWomen ?? 0,
    avgMenHourly,
    avgWomenHourly,
    gapHourlyPct,
    vsMenPct: versusMen.pct,
    vsWomenPct: versusWomen.pct,
    vsMenText: versusMen.text,
    vsWomenText: versusWomen.text,
    vsMenHourlyPct: versusMenHourly.pct,
    vsWomenHourlyPct: versusWomenHourly.pct,
    vsMenHourlyText: versusMenHourly.text,
    vsWomenHourlyText: versusWomenHourly.text,
    qualification: person.qualification || "—",
    jobFamily: person.jobFamily || "—",
    grade: person.grade || "—",
    payBand: person.payBand || "—",
    educationLevel: person.educationLevel || "—",
    scope,
    perimeterText: payLetterPerimeter(scope, ccnl),
    minPerGender,
    components,
    quartile,
  };
}

function euro(value: number): string {
  return `${value.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

function deviation(pct: number | null): string {
  return pct == null ? "n/d" : `${pct.toFixed(2).replace(".", ",")}%`;
}

function stamp(date: Date): string {
  return date.toLocaleString("it-IT");
}

export function downloadPayLetter(letter: Exclude<PayLetterAssessment, { ok: false }>): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${letter.company} - ${letter.personName}`, MARGIN, 12);
  doc.text(`Generato: ${stamp(letter.generatedAt)}`, pageWidth - MARGIN, 12, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Comunicazione retributiva", pageWidth / 2, 24, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Risposta al diritto di informazione retributiva", pageWidth / 2, 31, { align: "center" });

  const facts: [string, string][] = [
    ["Ragione sociale datore di lavoro:", letter.company],
    ["Data di generazione:", stamp(letter.generatedAt)],
    ["Richiedente:", letter.personName],
    ["Livello di inquadramento CCNL:", letter.levelLabel],
    ["CCNL applicato:", letter.ccnl],
    ["Periodo di riferimento dati:", letter.periodLabel],
  ];
  let y = 42;
  facts.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, MARGIN + 68, y);
    y += 6;
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("1. Retribuzione del richiedente", MARGIN, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Voce", "Valore"]],
    body: [
      ["RAL annua (FTE)", euro(letter.ownFte)],
      ["Retribuzione oraria", letter.ownHourly == null ? "n/d" : euro(letter.ownHourly)],
      [
        "Anzianità di servizio (dati di origine)",
        letter.seniorityYears == null
          ? "—"
          : `${String(letter.seniorityYears).replace(".", ",")} anni`,
      ],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [45, 62, 80] },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const note = doc.splitTextToSize(
    "Il livello retributivo comprende la retribuzione base e le componenti strutturali continuative e fisse; sono esclusi i trattamenti individuali non strutturali. Valori normalizzati full-time equivalent (FTE).",
    pageWidth - MARGIN * 2
  );
  doc.text(note, MARGIN, y);
  y += note.length * 4 + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("2. Confronto con la categoria", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const dropsContract = letter.scope === "annex"
    || letter.scope === "level"
    || (letter.scope === "group" && environmentalAnnex(letter.ccnl));
  const contractText = dropsContract ? "" : `, stesso CCNL («${letter.ccnl}»)`;
  const category = doc.splitTextToSize(
    `Categoria di riferimento ${letter.perimeterText}: stesso livello di inquadramento («${letter.levelLabel}»)${contractText}, inclusa la retribuzione del richiedente. Numerosità: ${letter.categorySize} (uomini: ${letter.nMen}, donne: ${letter.nWomen}). Soglia privacy: ${letter.minPerGender} persone per genere, escluso il richiedente. Le medie di categoria includono il richiedente.`,
    pageWidth - MARGIN * 2
  );
  doc.text(category, MARGIN, y);
  y += category.length * 4 + 2;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Indicatore di categoria", "Valore"]],
    body: [
      ["Media uomini (RAL FTE)", euro(letter.avgMen)],
      ["Media donne (RAL FTE)", euro(letter.avgWomen)],
      ["Media oraria uomini", letter.avgMenHourly == null ? "n/d" : euro(letter.avgMenHourly)],
      ["Media oraria donne", letter.avgWomenHourly == null ? "n/d" : euro(letter.avgWomenHourly)],
      ["GAP media oraria", SalaryMath.formatSignedGap(letter.gapHourlyPct)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [45, 62, 80] },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Posizionamento del richiedente", MARGIN, y);
  y += 2;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Riferimento", "Media categoria", "Scostamento %", "Posizionamento"]],
    body: [
      [
        "Media RAL donne",
        euro(letter.avgWomen),
        deviation(letter.vsWomenPct),
        letter.vsWomenText,
      ],
      [
        "Media RAL uomini",
        euro(letter.avgMen),
        deviation(letter.vsMenPct),
        letter.vsMenText,
      ],
      [
        "Media oraria donne",
        letter.avgWomenHourly == null ? "n/d" : euro(letter.avgWomenHourly),
        deviation(letter.vsWomenHourlyPct),
        letter.vsWomenHourlyText,
      ],
      [
        "Media oraria uomini",
        letter.avgMenHourly == null ? "n/d" : euro(letter.avgMenHourly),
        deviation(letter.vsMenHourlyPct),
        letter.vsMenHourlyText,
      ],
    ],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [45, 62, 80] },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  const amount = (value: number | null) => (value == null ? "n/d" : euro(value));
  if (y > 230) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("3. Posizionamento nella categoria e divario di genere", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const quartileText = ["nel 25% con la retribuzione base più bassa", "tra il 25% e il 50%", "tra il 50% e il 75%", "nel 25% con la retribuzione base più alta"][letter.quartile - 1];
  const position = doc.splitTextToSize(
    `La retribuzione base del richiedente si colloca nel ${letter.quartile}° quartile della categoria (${quartileText}). Medie e mediane per genere della categoria, per componente retributiva:`,
    pageWidth - MARGIN * 2
  );
  doc.text(position, MARGIN, y);
  y += position.length * 4 + 2;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Componente", "Richiedente", "Mediana categoria", "Scost. da mediana", "Media U", "Media D", "Gap medio", "Mediana U", "Mediana D", "Gap mediano"]],
    body: letter.components.map((c) => [
      c.label,
      amount(c.own),
      amount(c.median),
      deviation(c.vsMedianPct),
      amount(c.meanM),
      amount(c.meanF),
      SalaryMath.formatSignedGap(c.gapMean),
      amount(c.medianM),
      amount(c.medianF),
      SalaryMath.formatSignedGap(c.gapMedian),
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: [45, 62, 80] },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const gapNote = doc.splitTextToSize(
    "Gap = (valore uomini − valore donne) / valore uomini: positivo se gli uomini percepiscono di più. Retribuzione totale: base FTE più componenti variabili e voci annue continuative.",
    pageWidth - MARGIN * 2
  );
  doc.text(gapNote, MARGIN, y);
  y += gapNote.length * 4 + 4;
  const closing = doc.splitTextToSize(
    "I confronti utilizzano esclusivamente medie aggregate della categoria; non sono riportate retribuzioni nominali di altri dipendenti.",
    pageWidth - MARGIN * 2
  );
  doc.text(closing, MARGIN, y);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const height = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Comunicazione v1.0.0 - ${stamp(letter.generatedAt)}`, MARGIN, height - 10);
    doc.text(`Pag. ${page}`, pageWidth - MARGIN, height - 10, { align: "right" });
  }

  const safeName = letter.personName.replace(/[^\w.-]+/g, "-");
  doc.save(`comunicazione-retributiva-${safeName}.pdf`);
}

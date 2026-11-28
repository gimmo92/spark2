import type { Doc } from "@spark/core";
import { LevelTaxonomy } from "./analysis/LevelTaxonomy";
import { yearsOfService } from "./analysis/RoleAnalyzer";
import type { Employee } from "./models/Employee";

/**
 * Official minimum pay of a CCNL (collection `ccnlTables`, one record per contract as named in the
 * payroll data). A row gives the monthly minimum of a level (one value, or one per seniority class)
 * or an annual guarantee (executives). Annual minimum = monthly × `mensilita`.
 */
export interface CcnlTableDoc extends Doc {
  /** CCNL name exactly as in the payroll data (column CCNL). */
  ccnl: string;
  /** Document the figures come from (agreement, date, pages). */
  source: string;
  /** Date from which the figures apply (YYYY-MM-DD). */
  validFrom?: string;
  /** Contract expiry, if known (shown: an expired CCNL keeps applying until renewed). */
  expires?: string;
  mensilita: number;
  /** Seniority classes: first class covers `first` years, then one class every `step` years. */
  classes?: { first: number; step: number };
  rows: CcnlRow[];
  note?: string;
  source_kind: "libreria" | "pdf" | "manuale";
  updatedAt: string;
  updatedBy?: string;
}

export interface CcnlRow {
  level: string;
  /** Monthly minimum, one value per seniority class (a single value when there are no classes). */
  monthly?: number[];
  /** Annual minimum guarantee (e.g. executives), used instead of the monthly figures. */
  annual?: number;
}

/** Level as written in the payroll data, normalised to compare with the table ("Livello 3" → "3"). */
export const levelKey = (raw: unknown) =>
  String(raw == null ? "" : LevelTaxonomy.displayLabel(raw))
    .replace(/^livello\s*/i, "")
    .trim()
    .toLowerCase();

export const classIndex = (years: number, classes: CcnlTableDoc["classes"], count: number) => {
  if (!classes || count <= 1) return 0;
  const i = years < classes.first ? 0 : Math.floor((years - classes.first) / Math.max(1, classes.step)) + 1;
  return Math.min(count - 1, i);
};

export interface MinimumCheck {
  monthly: number | null;
  annual: number;
  classNo: number | null;
}

/** Official minimum of a person under a table (null = level not in the table). */
export function minimumFor(table: CcnlTableDoc, e: Employee): MinimumCheck | null {
  const row = table.rows.find((r) => levelKey(r.level) === levelKey(e.level));
  if (!row) return null;
  if (row.annual != null) return { monthly: null, annual: row.annual, classNo: null };
  const values = (row.monthly ?? []).filter((v) => Number.isFinite(v) && v > 0);
  if (!values.length) return null;
  const i = classIndex(yearsOfService(e) ?? 0, table.classes, values.length);
  const monthly = values[i]!;
  return { monthly, annual: monthly * table.mensilita, classNo: values.length > 1 ? i + 1 : null };
}

/**
 * Official tables already read by Spark from the agreements (the user can still check and edit them).
 * `match`: words that identify the contract in the payroll data.
 */
export const CCNL_LIBRARY: (Omit<CcnlTableDoc, "id" | "ccnl" | "updatedAt" | "source_kind"> & { key: string; label: string; match: RegExp; executives: boolean })[] = [
  {
    key: "ania",
    executives: false,
    label: "Assicurativo ANIA – personale non dirigente (dal 1/12/2024)",
    match: /assicurativ|ania/i,
    source: "Ipotesi di intesa rinnovo CCNL ANIA 22/2/2017, 16/11/2022, Allegati 2/B e 2/D (assunti dal 18/12/1999), decorrenza 1/12/2024",
    validFrom: "2024-12-01",
    expires: "2024-12-31",
    mensilita: 14,
    classes: { first: 4, step: 3 },
    rows: [
      { level: "7", monthly: [2791.88, 2883.46, 2975.03, 3066.61, 3158.18, 3249.75, 3341.33, 3432.9] },
      { level: "6", monthly: [2358.69, 2432.05, 2505.41, 2578.76, 2652.12, 2725.47, 2798.83, 2872.18, 2945.54, 3018.89, 3092.25, 3165.61] },
      { level: "5", monthly: [2210.31, 2279.05, 2347.79, 2416.53, 2485.26, 2554.01, 2622.75, 2691.49, 2760.23, 2828.97, 2897.71, 2966.45] },
      { level: "4", monthly: [2085.35, 2150.2, 2215.06, 2279.91, 2344.77, 2409.62, 2474.47, 2539.33, 2604.18, 2669.04, 2733.89, 2798.75] },
      { level: "3", monthly: [1911.4, 1970.85, 2030.29, 2089.74, 2149.18, 2208.63, 2268.07, 2327.52, 2386.96, 2446.4, 2505.85, 2565.29] },
      { level: "2", monthly: [1746.19, 1800.5, 1854.8, 1909.11, 1963.42, 2017.72, 2072.03, 2126.33, 2180.64, 2234.95, 2289.25, 2343.56] },
      { level: "1", monthly: [1656.31, 1707.82, 1759.33, 1810.84, 1862.35, 1913.86, 1965.37, 2016.88, 2068.4, 2119.91, 2171.42, 2222.93] },
      // funzionari: stipendio liv. 7 + indennità del grado (Allegato 2/D), stessa classe di anzianità
      { level: "Funzionario 1° grado", monthly: [3086.48, 3247.76, 3409.03, 3570.31, 3731.58, 3823.15, 3914.73, 4006.3] },
      { level: "Funzionario 2° grado", monthly: [3269.9, 3435.17, 3600.43, 3765.69, 3930.95, 4022.52, 4114.1, 4205.67] },
      { level: "Funzionario 3° grado", monthly: [3440.96, 3609.04, 3777.11, 3945.18, 4113.25, 4204.82, 4296.4, 4387.97] },
    ],
    note: "Classi di anzianità calcolate dagli anni di servizio (cl. 1 = anni 1-4, poi ogni 3 anni). Per i funzionari l'indennità segue gli anni da funzionario: qui approssimati con gli anni di servizio.",
  },
  {
    key: "ania-dirigenti",
    executives: true,
    label: "Dirigenti imprese assicuratrici ANIA (accordo 2/7/2018)",
    match: /assicur|ania|fidia/i,
    source: "Accordo ANIA–FIDIA 2/7/2018, Allegato 1 Tabella A: trattamento economico minimo complessivo",
    validFrom: "2018-07-02",
    mensilita: 14,
    rows: [{ level: "Dirigente", annual: 70000 }],
  },
  {
    key: "metalmeccanico",
    executives: false,
    label: "Metalmeccanico industria (minimi dal 1/6/2024)",
    match: /metalmeccanic|federmeccanica/i,
    source: "CCNL 5/2/2021 Federmeccanica-Assistal / Fim-Fiom-Uilm, tabella minimi dal 1/6/2024",
    validFrom: "2024-06-01",
    expires: "2024-06-30",
    mensilita: 13,
    rows: [
      { level: "D1", monthly: [1559.11] },
      { level: "D2", monthly: [1728.95] },
      { level: "C1", monthly: [1766.3] },
      { level: "C2", monthly: [1803.64] },
      { level: "C3", monthly: [1931.64] },
      { level: "B1", monthly: [2070.45] },
      { level: "B2", monthly: [2221.25] },
      { level: "B3", monthly: [2479.81] },
      { level: "A1", monthly: [2539.22] },
    ],
    note: "Tabella del contratto: se l'adeguamento IPCA supera l'aumento in tabella (giugno 2023) i minimi effettivi sono più alti.",
  },
  {
    key: "federmanager",
    executives: true,
    label: "Dirigenti industria Federmanager (garanzia 2026)",
    match: /federmanager|industr/i,
    source: "Rinnovo Confindustria–Federmanager 13/11/2024, art. 3: trattamento minimo complessivo di garanzia 80.000 € dal 2025, 85.000 € dal 2026",
    validFrom: "2026-01-01",
    mensilita: 13,
    rows: [{ level: "Dirigente", annual: 85000 }],
    note: "Il minimo di garanzia si confronta con il trattamento economico annuo complessivo del dirigente (qui la RAL a tempo pieno).",
  },
];

/** Library tables that fit a CCNL name of the payroll data (executives' contracts only for executives). */
export const libraryFor = (ccnl: string) => {
  const executives = /dirigent/i.test(ccnl);
  return CCNL_LIBRARY.filter((t) => t.match.test(ccnl) && t.executives === executives);
};

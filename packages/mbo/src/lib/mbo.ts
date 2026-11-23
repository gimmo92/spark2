export type SchedaStatus = "bozza" | "in_approvazione" | "approvata" | "consuntivata" | "archiviata";
export type CalcMode = "lineare" | "scaglioni";

/** One step of an objective: reaching `target` pays `payout` % of the objective's weight. */
export interface Level {
  target: number;
  payout: number;
}

/**
 * How an objective is measured. Every type maps onto the same target → payout levels, so scoring
 * (`payoutFor`) is the same for all of them:
 * - quantitativo: a number in any unit (€, %, n.);
 * - qualitativo_pct: a 0–100% assessment;
 * - qualitativo_5: a 1–5 rating;
 * - onoff: reached (1) or not (0), a single level at 1;
 * - progetto: a list of activities, the actual is the % of activities completed;
 * - data: a deadline, values are days since 1970-01-01 (`toDay`); the earlier, the higher the payout.
 */
export type ObjectiveType = "quantitativo" | "qualitativo_pct" | "qualitativo_5" | "onoff" | "progetto" | "data";

export const OBJECTIVE_TYPES: {
  value: ObjectiveType;
  label: string;
  hint: string;
}[] = [
  {
    value: "quantitativo",
    label: "Quantitativo",
    hint: "Un valore misurabile, in qualsiasi unità (€, %, n.)",
  },
  {
    value: "qualitativo_pct",
    label: "Qualitativo 0-100%",
    hint: "Una valutazione in percentuale",
  },
  {
    value: "qualitativo_5",
    label: "Qualitativo 1-5",
    hint: "Una valutazione su scala da 1 a 5",
  },
  { value: "onoff", label: "On/Off", hint: "Raggiunto o non raggiunto" },
  {
    value: "progetto",
    label: "Progetto",
    hint: "Una lista di attività: conta la % di attività completate",
  },
  {
    value: "data",
    label: "Data",
    hint: "Una scadenza: prima si chiude, più alto è il payout",
  },
];

/** "2026-06-30" → days since 1970-01-01 (how "data" objectives store dates). */
export const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);
/** Days since 1970-01-01 → "2026-06-30". */
export const fromDay = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
const dateLabel = (n: number) => new Date(n * 86_400_000).toLocaleDateString("it-IT", { timeZone: "UTC" });
export const typeOf = (d: Pick<ObjectiveDef, "type">): ObjectiveType => d.type ?? "quantitativo";
export const typeLabel = (d: Pick<ObjectiveDef, "type">) => OBJECTIVE_TYPES.find((t) => t.value === typeOf(d))?.label ?? "Quantitativo";

/** One activity of a "progetto" objective. */
export interface Activity {
  id: string;
  title: string;
}

/** Unit, calc mode and levels a new objective of this type starts from. */
export function typeDefaults(type: ObjectiveType): Pick<ObjectiveDef, "unit" | "calc" | "levels"> {
  switch (type) {
    case "qualitativo_pct":
      return {
        unit: "%",
        calc: "lineare",
        levels: [
          { target: 60, payout: 50 },
          { target: 80, payout: 100 },
          { target: 100, payout: 150 },
        ],
      };
    case "qualitativo_5":
      return {
        unit: "/5",
        calc: "scaglioni",
        levels: [
          { target: 3, payout: 50 },
          { target: 4, payout: 100 },
          { target: 5, payout: 150 },
        ],
      };
    case "onoff":
      return {
        unit: "",
        calc: "scaglioni",
        levels: [{ target: 1, payout: 100 }],
      };
    case "progetto":
      return {
        unit: "%",
        calc: "lineare",
        levels: [
          { target: 50, payout: 50 },
          { target: 100, payout: 100 },
        ],
      };
    case "data":
      return {
        unit: "",
        calc: "scaglioni",
        levels: [
          { target: toDay("2026-12-31"), payout: 50 },
          { target: toDay("2026-09-30"), payout: 100 },
          { target: toDay("2026-06-30"), payout: 150 },
        ],
      };
    default:
      return {
        unit: "%",
        calc: "lineare",
        levels: [
          { target: 80, payout: 50 },
          { target: 100, payout: 100 },
          { target: 120, payout: 150 },
        ],
      };
  }
}

/** Allowed range of the actual value (undefined = any number). */
export function typeRange(type: ObjectiveType): { min: number; max: number; step: number } | undefined {
  if (type === "qualitativo_pct" || type === "progetto") return { min: 0, max: 100, step: 1 };
  if (type === "qualitativo_5") return { min: 1, max: 5, step: 1 };
  if (type === "onoff") return { min: 0, max: 1, step: 1 };
  return undefined;
}

const num = (n: number) => n.toLocaleString("it-IT", { maximumFractionDigits: 2 });

/** An actual (or target) value as people read it: "Raggiunto", "4/5", "60%", "1.200 €". */
export function formatValue(d: ObjectiveDef, v: number): string {
  const t = typeOf(d);
  if (t === "onoff") return v >= 1 ? "Raggiunto" : "Non raggiunto";
  if (t === "qualitativo_5") return `${num(v)}/5`;
  if (t === "progetto") return `${num(v)}% attività`;
  if (t === "data") return dateLabel(v);
  return `${num(v)}${d.unit ? ` ${d.unit}` : ""}`;
}

export interface ObjectiveDef {
  id: string;
  name: string;
  /** Measurement type; missing = "quantitativo" (objectives saved before types existed). */
  type?: ObjectiveType;
  /** Activities of a "progetto" objective. */
  activities?: Activity[];
  unit: string;
  calc: CalcMode;
  levels: Level[]; // ordered by ascending target
  /** Catalog-only metadata (absent on one-off objectives inside a scheda). */
  description?: string;
  category?: string;
  /** Reference cycle (year or period), one of CYCLES. */
  cycle?: string;
  archived?: boolean;
  updatedAt?: string;
}

/** Objective category = organisational level it is measured at. */
export const CATEGORIES = ["Gruppo", "Società", "Business Unit", "Team", "Utente"];

/** An objective inside a scheda: either from the catalog (objectiveId) or a one-off custom definition. */
export interface SchedaItem {
  id: string;
  weight: number;
  actual?: number;
  /** "progetto" objectives: ids of the completed activities (`actual` = their %). */
  done?: string[];
  objectiveId?: string;
  custom?: ObjectiveDef;
  /** Per-scheda target/payout levels overriding the catalog objective's defaults. */
  levels?: Level[];
}

export interface Scheda {
  id: string;
  name: string;
  assigneeIds: string[];
  cycle: string;
  status: SchedaStatus;
  items: SchedaItem[];
  /** Gate objective: if it doesn't reach its first level the whole scheda pays 0. */
  threshold?: { objectiveId: string; actual?: number; done?: string[] };
  /** Step of an MBO workflow the scheda was sent to ("Invia a workflow"). */
  workflow?: { workflowId: string; taskId: string; sentAt: string };
  updatedAt: string;
}

export const SCHEDA_STATUSES: { value: SchedaStatus; label: string }[] = [
  { value: "bozza", label: "Bozza" },
  { value: "in_approvazione", label: "In approvazione" },
  { value: "approvata", label: "Approvata" },
  { value: "consuntivata", label: "Consuntivata" },
  { value: "archiviata", label: "Archiviata" },
];
export const statusLabel = (s: SchedaStatus) => SCHEDA_STATUSES.find((x) => x.value === s)?.label ?? s;

export const CYCLES: { value: string; label: string }[] = [
  { value: "2026", label: "Anno 2026" },
  { value: "2026-H1", label: "2026 · Primo semestre" },
  { value: "2026-H2", label: "2026 · Secondo semestre" },
  { value: "2025", label: "Anno 2025" },
  { value: "2025-H2", label: "2025 · Secondo semestre" },
  { value: "2024", label: "Anno 2024" },
];
export const cycleLabel = (c: string) => CYCLES.find((x) => x.value === c)?.label ?? c;
export const cycleYear = (c: string) => Number(c.slice(0, 4));
export const YEARS = [2026, 2025, 2024];

export type Catalog = ObjectiveDef[];
export const catalogById = (catalog: Catalog, id?: string) => catalog.find((o) => o.id === id);
export const itemDef = (catalog: Catalog, it: SchedaItem): ObjectiveDef | undefined => {
  if (it.custom) return it.custom;
  const def = catalogById(catalog, it.objectiveId);
  return def && it.levels ? { ...def, levels: it.levels } : def;
};

/** Schede that use a catalog objective, as a weighted item or as threshold. */
export const schedeUsing = (schede: Scheda[], objectiveId: string) =>
  schede.filter((s) => s.threshold?.objectiveId === objectiveId || s.items.some((i) => !i.custom && i.objectiveId === objectiveId));

/** Payout % for an objective given the actual value. */
export function payoutFor(def: ObjectiveDef, actual?: number): number {
  // dates: earlier is better, so the scale is flipped (a later date is a "smaller" result)
  if (typeOf(def) === "data")
    return payoutFor(
      {
        ...def,
        type: "quantitativo",
        levels: def.levels.map((l) => ({ ...l, target: -l.target })),
      },
      actual == null ? undefined : -actual,
    );
  const lv = [...def.levels].sort((a, b) => a.target - b.target);
  if (actual == null || !lv.length || actual < lv[0].target) return 0;
  const last = lv[lv.length - 1];
  if (actual >= last.target) return last.payout;
  const i = lv.findLastIndex((l) => l.target <= actual);
  if (def.calc === "scaglioni") return lv[i].payout;
  const a = lv[i];
  const b = lv[i + 1];
  return Math.round(a.payout + ((actual - a.target) / (b.target - a.target)) * (b.payout - a.payout));
}

export const thresholdMet = (catalog: Catalog, s: Scheda) => {
  if (!s.threshold) return true;
  const def = catalogById(catalog, s.threshold.objectiveId);
  return !def || payoutFor(def, s.threshold.actual) > 0;
};

/** Company-wide threshold set in Impostazioni → MBO: applies to every scheda. */
export interface GlobalGate {
  objectiveId?: string;
  actual?: number;
}

/** Global threshold reached? Not configured or not yet measured counts as reached. */
export function globalGateMet(catalog: Catalog, g?: GlobalGate) {
  if (!g?.objectiveId || g.actual == null) return true;
  const def = catalogById(catalog, g.objectiveId);
  return !def || payoutFor(def, g.actual) > 0;
}

/** Weighted payout of the scheda in % (0 if the global or the scheda's own threshold is missed). */
export function schedaScore(catalog: Catalog, s: Scheda, global?: GlobalGate): number {
  if (!globalGateMet(catalog, global) || !thresholdMet(catalog, s)) return 0;
  return Math.round(
    s.items.reduce((acc, it) => {
      const def = itemDef(catalog, it);
      return acc + (def ? (it.weight * payoutFor(def, it.actual)) / 100 : 0);
    }, 0),
  );
}

/** A measured result: the actual value and, for projects, the completed activities. */
export interface Measure {
  actual?: number;
  done?: string[];
}

/** % of a project's activities that are completed (undefined when nothing is ticked yet and nothing was measured). */
export function projectActual(d: ObjectiveDef, done: string[]): number | undefined {
  const acts = d.activities ?? [];
  if (!acts.length) return undefined;
  return Math.round((acts.filter((a) => done.includes(a.id)).length / acts.length) * 100);
}

/** Short description of the levels, e.g. "80 % → 50% · 100 % → 100%" or "Raggiunto → 100%". */
export function levelsText(d: ObjectiveDef, sep = " · "): string {
  if (typeOf(d) === "onoff") return `Raggiunto → ${d.levels[0]?.payout ?? 100}%`;
  return d.levels.map((l) => `${formatValue(d, l.target)} → ${l.payout}%`).join(sep);
}

export const hasActuals = (s: Scheda) => s.items.some((i) => i.actual != null);

export interface Preset {
  id: string;
  name: string;
  description?: string;
  calc: CalcMode;
  levels: Level[];
}

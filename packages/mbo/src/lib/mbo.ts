import { localeTag, tr } from "@spark/core";

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
 * - progetto: a list of activities, the actual is the % of activities completed (each one weighted when
 *   the objective's weight is distributed over them);
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
const dateLabel = (n: number) => new Date(n * 86_400_000).toLocaleDateString(localeTag(), { timeZone: "UTC" });
export const typeOf = (d: Pick<ObjectiveDef, "type">): ObjectiveType => d.type ?? "quantitativo";
export const typeLabel = (d: Pick<ObjectiveDef, "type">) => tr(OBJECTIVE_TYPES.find((t) => t.value === typeOf(d))?.label ?? "Quantitativo");

/** One activity of a "progetto" objective. */
export interface Activity {
  id: string;
  title: string;
  /** Share of the objective (%) when the project's weight is distributed over its activities. */
  weight?: number;
  /** How the activity is measured; missing = "onoff". */
  kind?: ActivityKind;
  /** "kpi": unit of measure and the target that means 100% done. */
  unit?: string;
  target?: number;
  /** Own target → payout levels (objective with `activityLevels`). */
  levels?: Level[];
}

/** Switches of the MBO module a client app can turn on (`createMboModule(options)`). */
export interface MboOptions {
  /** "progetto" objectives may have target → payout levels per activity. */
  activityLevels?: boolean;
  /** "Visualizza" on a scheda opens this page (a client screen) instead of the standard preview. */
  schedaViewHref?: (schedaId: string) => string;
}

/** Levels an activity starts from: its completion pays 100%. */
export function activityDefaultLevels(a: Activity): Level[] {
  const kind = activityKind(a);
  return [{ target: kind === "onoff" ? 1 : kind === "pct" ? 100 : (a.target ?? 100), payout: 100 }];
}

const KIND_TYPE: Record<ActivityKind, ObjectiveType> = { onoff: "onoff", pct: "qualitativo_pct", kpi: "quantitativo" };

/** An activity seen as an objective of its own (its kind, unit and levels): for payout, labels and the levels editor. */
export function activityDef(d: Pick<ObjectiveDef, "calc">, a: Activity): ObjectiveDef {
  const kind = activityKind(a);
  return {
    id: a.id,
    name: a.title,
    type: KIND_TYPE[kind],
    unit: kind === "kpi" ? (a.unit ?? "") : kind === "pct" ? "%" : "",
    calc: d.calc,
    levels: a.levels?.length ? a.levels : activityDefaultLevels(a),
  };
}

/** Measured value of one activity (on/off: 1 or 0). */
export function activityValue(a: Activity, m: Measure): number | undefined {
  if (activityKind(a) === "onoff") return m.done?.includes(a.id) ? 1 : 0;
  const v = m.values?.[a.id];
  return v == null || Number.isNaN(v) ? undefined : v;
}

/** How a project activity is measured: done / not done, a 0-100 % completion, or a KPI against its target. */
export type ActivityKind = "onoff" | "pct" | "kpi";
export const ACTIVITY_KINDS: { value: ActivityKind; label: string }[] = [
  { value: "onoff", label: "On/Off" },
  { value: "pct", label: "0-100%" },
  { value: "kpi", label: "KPI" },
];
export const activityKind = (a: Activity): ActivityKind => a.kind ?? "onoff";

/** Completion (0..1) of one activity from its measured value. */
export function activityProgress(a: Activity, m: Measure): number {
  const kind = activityKind(a);
  const v = m.values?.[a.id];
  if (kind === "onoff") return m.done?.includes(a.id) ? 1 : 0;
  if (v == null || Number.isNaN(v)) return 0;
  const p = kind === "pct" ? v / 100 : a.target && a.target > 0 ? v / a.target : 0;
  return Math.max(0, Math.min(1, p));
}

/** Share (%) of the objective each activity is worth: its own weight when distributed, otherwise an equal share. */
export function activityWeight(d: Pick<ObjectiveDef, "activities" | "weightedActivities">, a: Activity): number {
  const n = d.activities?.length ?? 0;
  if (!n) return 0;
  return d.weightedActivities ? (a.weight ?? 0) : 100 / n;
}

/** Integer weights summing to 100, split as evenly as possible. */
export function evenWeights(n: number): number[] {
  const base = Math.floor(100 / n);
  return Array.from({ length: n }, (_, i) => base + (i < 100 - base * n ? 1 : 0));
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

const num = (n: number) => n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });

/** An actual (or target) value as people read it: "Raggiunto", "4/5", "60%", "1.200 €". */
export function formatValue(d: ObjectiveDef, v: number): string {
  const t = typeOf(d);
  if (t === "onoff") return v >= 1 ? tr("Raggiunto") : tr("Non raggiunto");
  if (t === "qualitativo_5") return `${num(v)}/5`;
  if (t === "progetto") return tr("{0}% attività", [num(v)]);
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
  /** "progetto": the objective's weight is distributed over the activities (`Activity.weight`, summing to 100). */
  weightedActivities?: boolean;
  /** "progetto": every activity has its own target → payout levels; the objective's payout is their weighted sum. */
  activityLevels?: boolean;
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
  /** "progetto" objectives: ids of the completed on/off activities (`actual` = the project's %). */
  done?: string[];
  /** "progetto" objectives: measured value of each 0-100 % / KPI activity, by activity id. */
  values?: Record<string, number>;
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
  threshold?: { objectiveId: string; actual?: number; done?: string[]; values?: Record<string, number> };
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
export const statusLabel = (s: SchedaStatus) => tr(SCHEDA_STATUSES.find((x) => x.value === s)?.label ?? s);

export const CYCLES: { value: string; label: string }[] = [
  { value: "2026", label: "Anno 2026" },
  { value: "2026-H1", label: "2026 · Primo semestre" },
  { value: "2026-H2", label: "2026 · Secondo semestre" },
  { value: "2025", label: "Anno 2025" },
  { value: "2025-H2", label: "2025 · Secondo semestre" },
  { value: "2024", label: "Anno 2024" },
];
export const cycleLabel = (c: string) => tr(CYCLES.find((x) => x.value === c)?.label ?? c);
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
  // levels per activity: the measured value is the project's payout itself
  if (typeOf(def) === "progetto" && def.activityLevels) return actual == null ? 0 : Math.round(actual);
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
  /** "progetto": completed on/off activities. */
  done?: string[];
  /** "progetto": value of each 0-100 % / KPI activity. */
  values?: Record<string, number>;
}

/** % of a project's activities that are completed (undefined when nothing is ticked yet and nothing was measured). */
export function projectActual(d: ObjectiveDef, m: Measure): number | undefined {
  const acts = d.activities ?? [];
  if (!acts.length) return undefined;
  if (!m.done?.length && !Object.keys(m.values ?? {}).length) return undefined;
  // levels per activity: the "actual" is already the payout (weighted sum of each activity's payout)
  if (d.activityLevels)
    return Math.round(acts.reduce((sum, a) => sum + (activityWeight(d, a) * payoutFor(activityDef(d, a), activityValue(a, m))) / 100, 0) * 10) / 10;
  return Math.round(acts.reduce((sum, a) => sum + activityWeight(d, a) * activityProgress(a, m), 0) * 10) / 10;
}

/** Short description of the levels, e.g. "80 % → 50% · 100 % → 100%" or "Raggiunto → 100%". */
export function levelsText(d: ObjectiveDef, sep = " · "): string {
  if (typeOf(d) === "onoff") return tr("Raggiunto → {0}%", [d.levels[0]?.payout ?? 100]);
  if (typeOf(d) === "progetto" && d.activityLevels) return tr("Livelli per attività");
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

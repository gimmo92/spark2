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
  /** "quantitativo" objectives may set levels in % of last year's actual (entered per scheda) or of the target. */
  relativeLevels?: boolean;
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

/** What a level of a relative scale is calculated on: last year's actual, the target, or a fixed value. */
export type RelativeOf = "base" | "target" | "value";

/** A level of a relative scale: `pct` % of last year's actual ("base") or of the target, or the value itself ("value"). */
export interface RelativeLevel {
  pct: number;
  of: RelativeOf;
  payout: number;
}

/**
 * Levels per objective where each one says what it is calculated on: the target (pays 100%) is `target` %
 * of last year's actual (`SchedaItem.base`, entered per scheda) or a fixed value (`targetOf: "value"`);
 * the other levels are a % of last year, a % of the target or a fixed value.
 * E.g. minimum 90% of last year → 10%, target 108% of last year → 100%, 110% of the target → 120%.
 */
export interface RelativeScale {
  target: number;
  targetOf?: "base" | "value";
  levels: RelativeLevel[];
}

/** A resolved level of a relative scale, with the % / value it was defined by. */
export interface RelativeRow extends Level {
  pct: number;
  of: RelativeOf;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The scale needs last year's actual (some level is a % of it). */
export const needsBase = (r: RelativeScale) => (r.targetOf ?? "base") === "base" || r.levels.some((l) => l.of === "base");
/** Fixed values mixed with % of last year: the order of the levels depends on each scheda's actual. */
export const mixedScale = (r: RelativeScale) => needsBase(r) && ((r.targetOf ?? "base") === "value" || r.levels.some((l) => l.of === "value"));

/** Levels of a relative scale for a given base, ascending (the target row is the one paying 100%). */
export function relativeRows(r: RelativeScale, base = 0): RelativeRow[] {
  const targetOf = r.targetOf ?? "base";
  const t = targetOf === "value" ? r.target : (base * r.target) / 100;
  const at = (l: RelativeLevel) => (l.of === "value" ? l.pct : ((l.of === "base" ? base : t) * l.pct) / 100);
  return [
    { target: round2(t), payout: 100, pct: r.target, of: targetOf as RelativeOf },
    ...r.levels.map((l) => ({ target: round2(at(l)), payout: l.payout, pct: l.pct, of: l.of })),
  ].sort((a, b) => a.target - b.target);
}
export const resolveRelative = (r: RelativeScale, base = 0): Level[] => relativeRows(r, base).map(({ target, payout }) => ({ target, payout }));

/** Plain target → payout levels as a scale of fixed values (target = the level paying 100%, or the closest). */
export function toRelative(levels: Level[]): RelativeScale {
  if (!levels.length) return { target: 100, targetOf: "value", levels: [] };
  let ti = 0;
  levels.forEach((l, i) => {
    if (Math.abs(l.payout - 100) < Math.abs(levels[ti].payout - 100)) ti = i;
  });
  return {
    target: levels[ti].target,
    targetOf: "value",
    levels: levels.filter((_, i) => i !== ti).map((l) => ({ pct: l.target, of: "value" as const, payout: l.payout })),
  };
}

/** Relative scale a quantitative objective starts from: 90% of last year → 50%, target 105% → 100%, 110% of the target → 150%. */
export const DEFAULT_RELATIVE: RelativeScale = {
  target: 105,
  levels: [
    { pct: 90, of: "base", payout: 50 },
    { pct: 110, of: "target", payout: 150 },
  ],
};

/** Fields for an objective with this relative scale; its standard levels are the scale on a base of 100. */
export const relativePatch = (r: RelativeScale) => ({ relative: r, levels: resolveRelative(r, needsBase(r) ? 100 : 0) });

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
  /** "quantitativo": levels relative to last year's actual, entered per scheda (`SchedaItem.base`). */
  relative?: RelativeScale;
  /** Set by `itemDef` on relative objectives: the scheda's last-year actual the levels were computed from. */
  base?: number;
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
  /** Objectives with relative levels: last year's actual, the levels are computed from it. */
  base?: number;
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
  const def = it.custom ?? catalogById(catalog, it.objectiveId);
  if (!def) return undefined;
  // relative levels: computed from the scheda's last-year actual (none yet = no levels, payout 0)
  if (def.relative && typeOf(def) === "quantitativo")
    return {
      ...def,
      base: it.base,
      levels: !needsBase(def.relative) ? resolveRelative(def.relative) : it.base != null && it.base > 0 ? resolveRelative(def.relative, it.base) : [],
    };
  return !it.custom && it.levels ? { ...def, levels: it.levels } : def;
};

/** Short description of a relative scale, e.g. "90% AP → 10% · 108% AP → 100% · 110% target → 120%". */
export function relativeText(r: RelativeScale, sep = " · "): string {
  // fixed values mixed with % of last year: keep the order they were entered in (it depends on the actual)
  const rows = mixedScale(r)
    ? [{ pct: r.target, of: (r.targetOf ?? "base") as RelativeOf, payout: 100 }, ...r.levels]
    : relativeRows(r, 100);
  return rows
    .map((l) => `${l.of === "base" ? tr("{0}% AP", [num(l.pct)]) : l.of === "target" ? tr("{0}% target", [num(l.pct)]) : num(l.pct)} → ${l.payout}%`)
    .join(sep);
}

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
  if (d.relative && typeOf(d) === "quantitativo" && needsBase(d.relative) && !(d.base != null && d.base > 0)) return relativeText(d.relative, sep);
  return d.levels.map((l) => `${formatValue(d, l.target)} → ${l.payout}%`).join(sep);
}

export const hasActuals = (s: Scheda) => s.items.some((i) => i.actual != null);

export interface Preset {
  id: string;
  name: string;
  description?: string;
  calc: CalcMode;
  levels: Level[];
  /** Levels per % of last year / % of the target / fixed value (`relativeLevels` option); `levels` = the scale on a base of 100. */
  relative?: RelativeScale;
}

export type SchedaStatus = "bozza" | "in_approvazione" | "approvata" | "consuntivata" | "archiviata";
export type CalcMode = "lineare" | "scaglioni";

/** One step of an objective: reaching `target` pays `payout` % of the objective's weight. */
export interface Level {
  target: number;
  payout: number;
}

export interface ObjectiveDef {
  id: string;
  name: string;
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
  threshold?: { objectiveId: string; actual?: number };
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

export const hasActuals = (s: Scheda) => s.items.some((i) => i.actual != null);

export interface Preset {
  id: string;
  name: string;
  description?: string;
  calc: CalcMode;
  levels: Level[];
}

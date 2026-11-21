import type { User } from "./data";

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

const o = (
  id: string,
  name: string,
  category: string,
  description: string,
  unit: string,
  calc: CalcMode,
  levels: [number, number][],
): ObjectiveDef => ({ id, name, category, description, unit, calc, levels: levels.map(([target, payout]) => ({ target, payout })), updatedAt: "2026-01-15" });

const SEED_BASE: ObjectiveDef[] = [
  o("ob-fatturato", "Fatturato area di competenza", "Business Unit", "Ricavi netti fatturati nell'area o nel portafoglio clienti assegnato.", "M€", "lineare", [[8, 50], [10, 100], [12, 150]]),
  o("ob-oee", "Efficienza OEE impianti", "Team", "Overall Equipment Effectiveness media degli impianti di competenza.", "%", "lineare", [[70, 50], [78, 100], [85, 130]]),
  o("ob-nps", "Customer satisfaction (NPS)", "Società", "Net Promoter Score rilevato dalla survey clienti annuale.", "pt", "lineare", [[30, 50], [40, 100], [50, 120]]),
  o("ob-consegne", "Puntualità consegne", "Società", "Percentuale di ordini consegnati entro la data confermata.", "%", "lineare", [[90, 50], [95, 100], [98, 120]]),
  o("ob-formazione", "Ore di formazione completate", "Utente", "Ore medie di formazione completate dal team nel periodo.", "h", "scaglioni", [[20, 50], [32, 100], [40, 110]]),
  o("ob-clienti", "Nuovi clienti acquisiti", "Utente", "Numero di nuovi clienti con almeno un ordine nel periodo.", "n.", "scaglioni", [[5, 50], [8, 100], [12, 150]]),
  o("ob-margine", "Margine operativo di reparto", "Business Unit", "Margine operativo sul fatturato del reparto, da controllo di gestione.", "%", "lineare", [[12, 50], [15, 100], [18, 140]]),
  o("ob-energia", "Risparmio costi energetici", "Società", "Riduzione dei costi energetici rispetto all'anno precedente.", "k€", "lineare", [[50, 50], [80, 100], [120, 150]]),
  o("ob-digitale", "Processi digitalizzati", "Team", "Processi passati da gestione cartacea a strumenti digitali.", "n.", "scaglioni", [[2, 50], [4, 100], [6, 120]]),
  o("ob-sicurezza", "Giorni senza infortuni", "Società", "Giorni consecutivi senza infortuni registrati nello stabilimento.", "gg", "scaglioni", [[300, 50], [340, 100], [365, 120]]),
  o("ob-magazzino", "Rotazione di magazzino", "Team", "Indice di rotazione delle scorte (costo del venduto / giacenza media).", "volte", "lineare", [[4, 50], [6, 100], [8, 130]]),
  o("ob-ebitda", "EBITDA di Gruppo", "Gruppo", "EBITDA consolidato di Gruppo. Usato tipicamente come obiettivo soglia.", "M€", "scaglioni", [[40, 100]]),
  o("ob-utile", "Utile netto aziendale", "Gruppo", "Utile netto da bilancio civilistico. Usato tipicamente come obiettivo soglia.", "M€", "scaglioni", [[18, 100]]),
  { ...o("ob-carta", "Riduzione consumo carta", "Società", "Risme di carta acquistate in meno rispetto all'anno precedente.", "%", "scaglioni", [[10, 50], [20, 100]]), archived: true },
];

const SEED_CYCLE: Record<string, string> = { "ob-digitale": "2026-H1", "ob-formazione": "2026-H2", "ob-carta": "2025" };
export const SEED_OBJECTIVES: ObjectiveDef[] = SEED_BASE.map((d) => ({ ...d, cycle: SEED_CYCLE[d.id] ?? "2026" }));

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

/** Weighted payout of the scheda in % (0 if the threshold objective is missed). */
export function schedaScore(catalog: Catalog, s: Scheda): number {
  if (!thresholdMet(catalog, s)) return 0;
  return Math.round(
    s.items.reduce((acc, it) => {
      const def = itemDef(catalog, it);
      return acc + (def ? (it.weight * payoutFor(def, it.actual)) / 100 : 0);
    }, 0),
  );
}

export const hasActuals = (s: Scheda) => s.items.some((i) => i.actual != null);

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

export function buildSeedSchede(users: User[]): Scheda[] {
  const rand = rng(7);
  const pickable = SEED_OBJECTIVES.filter((o) => o.levels.length > 1 && !o.archived);
  const people = users.filter((u) => u.status === "attivo").slice(0, 46);
  const out: Scheda[] = [];
  const actualFor = (def: ObjectiveDef) => {
    const lo = def.levels[0].target * 0.9;
    const hi = def.levels[def.levels.length - 1].target * 1.03;
    const v = lo + rand() * (hi - lo);
    return Math.round(v * 10) / 10;
  };

  people.forEach((u, i) => {
    const cycles = i % 3 === 0 ? ["2026", "2025"] : [i % 7 === 0 ? "2026-H1" : "2026"];
    cycles.forEach((cycle) => {
      const past = cycleYear(cycle) < 2026;
      const n = 3 + Math.floor(rand() * 3);
      const picks = [...pickable].sort(() => rand() - 0.5).slice(0, n);
      const base = Math.floor(100 / n);
      const status: SchedaStatus = past
        ? rand() < 0.25
          ? "archiviata"
          : "consuntivata"
        : (["bozza", "in_approvazione", "approvata", "approvata"] as SchedaStatus[])[Math.floor(rand() * 4)];
      const measured = status === "approvata" || status === "consuntivata" || status === "archiviata";
      // group a few schede with colleagues of the same team
      const extra =
        i % 5 === 0 ? users.filter((x) => x.status === "attivo" && x.team === u.team && x.id !== u.id).slice(0, 2).map((x) => x.id) : [];
      const gate = rand() < 0.4 ? catalogById(SEED_OBJECTIVES, rand() < 0.5 ? "ob-ebitda" : "ob-utile")! : undefined;
      out.push({
        id: `s${i + 1}-${cycle}`,
        name: `MBO ${cycle.slice(0, 4)} · ${u.role}`,
        assigneeIds: [u.id, ...extra],
        cycle,
        status,
        items: picks.map((def, k) => ({
          id: `it${i}-${cycle}-${k}`,
          objectiveId: def.id,
          weight: k === 0 ? 100 - base * (n - 1) : base,
          actual: measured ? actualFor(def) : undefined,
        })),
        threshold: gate ? { objectiveId: gate.id, actual: measured ? actualFor(gate) : undefined } : undefined,
        updatedAt: `${cycle.slice(0, 4)}-${String(1 + Math.floor(rand() * 10)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 27)).padStart(2, "0")}`,
      });
    });
  });
  return out;
}

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
}

/** An objective inside a scheda: either from the catalog (objectiveId) or a one-off custom definition. */
export interface SchedaItem {
  id: string;
  weight: number;
  actual?: number;
  objectiveId?: string;
  custom?: ObjectiveDef;
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

export const OBJECTIVE_CATALOG: ObjectiveDef[] = [
  { id: "ob-fatturato", name: "Fatturato area di competenza", unit: "M€", calc: "lineare", levels: [{ target: 8, payout: 50 }, { target: 10, payout: 100 }, { target: 12, payout: 150 }] },
  { id: "ob-oee", name: "Efficienza OEE impianti", unit: "%", calc: "lineare", levels: [{ target: 70, payout: 50 }, { target: 78, payout: 100 }, { target: 85, payout: 130 }] },
  { id: "ob-nps", name: "Customer satisfaction (NPS)", unit: "pt", calc: "lineare", levels: [{ target: 30, payout: 50 }, { target: 40, payout: 100 }, { target: 50, payout: 120 }] },
  { id: "ob-consegne", name: "Puntualità consegne", unit: "%", calc: "lineare", levels: [{ target: 90, payout: 50 }, { target: 95, payout: 100 }, { target: 98, payout: 120 }] },
  { id: "ob-formazione", name: "Ore di formazione completate", unit: "h", calc: "scaglioni", levels: [{ target: 20, payout: 50 }, { target: 32, payout: 100 }, { target: 40, payout: 110 }] },
  { id: "ob-clienti", name: "Nuovi clienti acquisiti", unit: "n.", calc: "scaglioni", levels: [{ target: 5, payout: 50 }, { target: 8, payout: 100 }, { target: 12, payout: 150 }] },
  { id: "ob-margine", name: "Margine operativo di reparto", unit: "%", calc: "lineare", levels: [{ target: 12, payout: 50 }, { target: 15, payout: 100 }, { target: 18, payout: 140 }] },
  { id: "ob-energia", name: "Risparmio costi energetici", unit: "k€", calc: "lineare", levels: [{ target: 50, payout: 50 }, { target: 80, payout: 100 }, { target: 120, payout: 150 }] },
  { id: "ob-digitale", name: "Processi digitalizzati", unit: "n.", calc: "scaglioni", levels: [{ target: 2, payout: 50 }, { target: 4, payout: 100 }, { target: 6, payout: 120 }] },
  { id: "ob-sicurezza", name: "Giorni senza infortuni", unit: "gg", calc: "scaglioni", levels: [{ target: 300, payout: 50 }, { target: 340, payout: 100 }, { target: 365, payout: 120 }] },
  { id: "ob-magazzino", name: "Rotazione di magazzino", unit: "volte", calc: "lineare", levels: [{ target: 4, payout: 50 }, { target: 6, payout: 100 }, { target: 8, payout: 130 }] },
  { id: "ob-ebitda", name: "EBITDA di Gruppo", unit: "M€", calc: "scaglioni", levels: [{ target: 40, payout: 100 }] },
  { id: "ob-utile", name: "Utile netto aziendale", unit: "M€", calc: "scaglioni", levels: [{ target: 18, payout: 100 }] },
];

export const catalogById = (id?: string) => OBJECTIVE_CATALOG.find((o) => o.id === id);
export const itemDef = (it: SchedaItem): ObjectiveDef | undefined => it.custom ?? catalogById(it.objectiveId);

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

export const thresholdMet = (s: Scheda) => {
  if (!s.threshold) return true;
  const def = catalogById(s.threshold.objectiveId);
  return !def || payoutFor(def, s.threshold.actual) > 0;
};

/** Weighted payout of the scheda in % (0 if the threshold objective is missed). */
export function schedaScore(s: Scheda): number {
  if (!thresholdMet(s)) return 0;
  return Math.round(
    s.items.reduce((acc, it) => {
      const def = itemDef(it);
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
  const pickable = OBJECTIVE_CATALOG.filter((o) => o.levels.length > 1);
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
      const gate = rand() < 0.4 ? catalogById(rand() < 0.5 ? "ob-ebitda" : "ob-utile")! : undefined;
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

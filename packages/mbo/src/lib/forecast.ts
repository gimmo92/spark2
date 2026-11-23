import { catalogById, itemDef, payoutFor, type Catalog, type GlobalGate, type ObjectiveDef, type Scheda, typeOf, typeRange } from "./mbo";

/** Starting point for every objective that has no explicit estimate. */
export type ForecastBase = "min" | "target" | "max" | "actual";

export const BASES: { value: ForecastBase; label: string; hint: string }[] = [
  { value: "min", label: "Pessimistico", hint: "Ogni obiettivo al livello minimo" },
  { value: "target", label: "A target", hint: "Ogni obiettivo al livello che paga il 100%" },
  { value: "max", label: "Ottimistico", hint: "Ogni obiettivo al livello massimo" },
  { value: "actual", label: "Consuntivi attuali", hint: "Usa i consuntivi già inseriti (altrimenti target)" },
];

export interface ForecastScenario {
  id: string;
  name: string;
  base: ForecastBase;
  /** Estimated result per catalog objective id (applies to every scheda that uses it, also as threshold). */
  estimates: Record<string, number>;
  /** Default bonus at 100% payout, per scheda (€). */
  bonusTarget: number;
  /** Per-scheda bonus at 100% (€), overriding bonusTarget. */
  bonusBySchede: Record<string, number>;
  savedAt?: string;
}

export const emptyScenario = (): ForecastScenario => ({
  id: "current",
  name: "Scenario corrente",
  base: "target",
  estimates: {},
  bonusTarget: 5000,
  bonusBySchede: {},
});

const sorted = (d: ObjectiveDef) => [...d.levels].sort((a, b) => a.target - b.target);

/** Level whose payout is closest to 100% ("at target"). */
export const targetLevel = (d: ObjectiveDef) =>
  sorted(d).reduce((best, l) => (Math.abs(l.payout - 100) < Math.abs(best.payout - 100) ? l : best), sorted(d)[0]);

export function baseValue(d: ObjectiveDef, base: ForecastBase, actual?: number): number {
  // by payout, not by target: for dates the best level is the earliest one
  const lv = [...d.levels].sort((a, b) => a.payout - b.payout);
  if (!lv.length) return 0;
  if (base === "actual" && actual != null) return actual;
  if (base === "min") return lv[0].target;
  if (base === "max") return lv[lv.length - 1].target;
  return targetLevel(d).target;
}

/** Slider range for an objective: a bit below the minimum level to a bit above the maximum. */
export function sliderRange(d: ObjectiveDef) {
  const fixed = typeRange(typeOf(d));
  if (fixed) return fixed;
  const lv = sorted(d);
  const lo = lv[0]?.target ?? 0;
  const hi = lv[lv.length - 1]?.target ?? 100;
  const span = Math.max(hi - lo, Math.abs(lo) * 0.2, 1);
  const min = lo - span * 0.5;
  const max = hi + span * 0.3;
  const step = span / 100 >= 1 ? Math.round(span / 100) : Number((span / 100).toPrecision(1));
  return { min: Math.floor(min), max: Math.ceil(max), step: step || 0.1 };
}

export interface SchedaForecast {
  scheda: Scheda;
  score: number; // weighted payout %
  gateOk: boolean;
  items: { id: string; name: string; weight: number; value: number; payout: number; estimated: boolean }[];
}

/** Forecast a scheda: each item uses the scenario estimate, else the scenario base; a missed threshold zeroes it. */
export function forecastScheda(s: Scheda, catalog: Catalog, sc: ForecastScenario, global?: GlobalGate): SchedaForecast {
  const items = s.items.flatMap((it) => {
    const def = itemDef(catalog, it);
    if (!def) return [];
    const explicit = !it.custom && it.objectiveId ? sc.estimates[it.objectiveId] : undefined;
    const value = explicit ?? baseValue(def, sc.base, it.actual);
    return [{ id: it.id, name: def.name, weight: Number(it.weight) || 0, value, payout: payoutFor(def, value), estimated: explicit != null }];
  });

  let gateOk = true;
  const globalDef = catalogById(catalog, global?.objectiveId);
  if (globalDef) {
    const v = sc.estimates[globalDef.id] ?? baseValue(globalDef, sc.base, global?.actual);
    gateOk = payoutFor(globalDef, v) > 0;
  }
  if (gateOk && s.threshold) {
    const gate = catalogById(catalog, s.threshold.objectiveId);
    if (gate) {
      const v = sc.estimates[gate.id] ?? baseValue(gate, sc.base, s.threshold.actual);
      gateOk = payoutFor(gate, v) > 0;
    }
  }
  const score = gateOk ? Math.round(items.reduce((a, i) => a + (i.weight * i.payout) / 100, 0)) : 0;
  return { scheda: s, score, gateOk, items };
}

export const bonusFor = (sc: ForecastScenario, schedaId: string) => sc.bonusBySchede[schedaId] ?? sc.bonusTarget;

import { catalogById, itemDef, payoutFor, relativeRows, type Catalog, type GlobalGate, type ObjectiveDef, type Scheda, typeOf, typeRange } from "./mbo";

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

/** The target level: the scale's target for % levels, otherwise the level whose payout is closest to 100%. */
export const targetLevel = (d: ObjectiveDef) => {
  const t = d.relative && d.levels.length ? relativeRows(d.relative, d.base ?? 0).find((r) => r.isTarget) : undefined;
  const hit = t && sorted(d).find((l) => l.target === t.target);
  return hit ?? sorted(d).reduce((best, l) => (Math.abs(l.payout - 100) < Math.abs(best.payout - 100) ? l : best), sorted(d)[0]);
};

/**
 * The objective as the forecast shows and estimates it: % levels resolved on the objective's last-year actual,
 * or on the first scheda in scope that has one. Other objectives as they are.
 */
export function forecastDef(def: ObjectiveDef, schede: Scheda[]): ObjectiveDef {
  if (!def.relative || typeOf(def) !== "quantitativo") return def;
  const own = def.lastYear != null && def.lastYear > 0;
  const it = own ? undefined : schede.flatMap((s) => s.items).find((i) => !i.custom && i.objectiveId === def.id && (i.base ?? 0) > 0);
  return itemDef([def], { id: "forecast", objectiveId: def.id, weight: 0, base: it?.base }) ?? def;
}

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

/**
 * Forecast a scheda: each item uses the scenario estimate, else the scenario base; a missed threshold zeroes it.
 * `shown`: the objectives as the estimates were made on (`forecastDef`); for % levels an estimate is moved to each
 * scheda's own target in proportion (e.g. 105% of the shown target = 105% of this scheda's target).
 */
export function forecastScheda(s: Scheda, catalog: Catalog, sc: ForecastScenario, global?: GlobalGate, shown?: Map<string, ObjectiveDef>): SchedaForecast {
  const items = s.items.flatMap((it) => {
    const def = itemDef(catalog, it);
    if (!def) return [];
    let explicit = !it.custom && it.objectiveId ? sc.estimates[it.objectiveId] : undefined;
    const ref = it.objectiveId ? shown?.get(it.objectiveId) : undefined;
    if (explicit != null && def.relative && ref && def.levels.length && ref.levels.length) {
      const tRef = targetLevel(ref).target;
      if (tRef) explicit = (explicit * targetLevel(def).target) / tRef;
    }
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

/**
 * Bonus at 100% of a whole scheda (all its assignees): the scenario's per-scheda value × assignees if set; otherwise,
 * with `bonusOf` (client option: each person's own target bonus), the sum of the assignees' bonuses (scenario default
 * for whoever has none); otherwise the scenario default × assignees.
 */
export function schedaBonus<U>(sc: ForecastScenario, s: Scheda, people: U[], bonusOf?: (u: U) => number | undefined): number {
  const n = Math.max(people.length, 1);
  const set = sc.bonusBySchede[s.id];
  if (set != null) return set * n;
  if (bonusOf && people.length) return people.reduce((a, u) => a + (bonusOf(u) ?? sc.bonusTarget), 0);
  return sc.bonusTarget * n;
}

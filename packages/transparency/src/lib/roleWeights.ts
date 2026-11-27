import type { Doc } from "@spark/core";
import { GapGroupAnalyzer, ComparisonRow } from "./analysis/GapGroupAnalyzer";
import { JobGradingAnalyzer } from "./analysis/JobGradingAnalyzer";
import { LevelTaxonomy } from "./analysis/LevelTaxonomy";
import type { Employee } from "./models/Employee";

/**
 * Job evaluation for "work of equal value" (EU directive 2023/970, art. 4): every role is scored 1–10
 * on the four criteria; the weighted total (10–100 points) puts roles of the whole company into
 * equal-value bands, where the gender pay gap is then computed (deterministic, like every other gap).
 */
export type Criterion = "competenze" | "responsabilita" | "impegno" | "condizioni";

export const CRITERIA: { id: Criterion; label: string; hint: string; weight: number }[] = [
  { id: "competenze", label: "Competenze", hint: "Formazione, conoscenze ed esperienza richieste", weight: 30 },
  { id: "responsabilita", label: "Responsabilità", hint: "Su persone, risultati, budget, sicurezza", weight: 40 },
  { id: "impegno", label: "Impegno", hint: "Sforzo mentale, fisico ed emotivo", weight: 20 },
  { id: "condizioni", label: "Condizioni di lavoro", hint: "Ambiente, turni, rischi, disagio", weight: 10 },
];

export type RoleScores = Record<Criterion, number>;

/** Weight of each criterion in the total (sum 100); the company can change them (settings doc "jobGrading"). */
export type CriteriaWeights = Record<Criterion, number>;
export const DEFAULT_WEIGHTS: CriteriaWeights = Object.fromEntries(CRITERIA.map((c) => [c.id, c.weight])) as CriteriaWeights;

/** Valid weights (integers ≥ 0 summing to 100), else the defaults. */
export function cleanWeights(v: unknown): CriteriaWeights {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const w = Object.fromEntries(CRITERIA.map((c) => [c.id, Math.max(0, Math.round(Number(o[c.id]) || 0))])) as CriteriaWeights;
  return CRITERIA.reduce((n, c) => n + w[c.id], 0) === 100 ? w : DEFAULT_WEIGHTS;
}

/** Saved weighting of one role (collection `roleWeights`, one record per role title). */
export interface RoleWeightDoc extends Doc {
  role: string;
  scores: RoleScores;
  rationale?: string;
  /** "ai" = proposed by the model, "manuale" = set or changed by a person. */
  source: "ai" | "manuale";
  confirmed: boolean;
  updatedAt: string;
  updatedBy?: string;
}

/** What the model sees about a role: no names, no pay. */
export interface RoleInput {
  role: string;
  n: number;
  level?: string;
  ccnl?: string;
  qualification?: string;
  description?: string;
  /** Required skills (from the role profile). */
  skills?: string[];
}

/** Job description and required skills of a role (collection `roleProfiles`), AI-written or edited by HR. */
export interface RoleProfileDoc extends Doc {
  role: string;
  description: string;
  skills: string[];
  source: "ai" | "manuale";
  updatedAt: string;
  updatedBy?: string;
}

export const roleTitle = (e: Pick<Employee, "role">) => String(e.role ?? "").trim();
export const roleId = (role: string) =>
  "r-" +
  role
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

const clampScore = (n: number) => Math.min(10, Math.max(1, Math.round(n)));
export const normalizeScores = (s: Partial<Record<Criterion, unknown>>): RoleScores =>
  Object.fromEntries(CRITERIA.map((c) => [c.id, clampScore(Number(s[c.id]) || 1)])) as RoleScores;

/** Weighted total, 10–100 points. */
export const roleScore = (s: RoleScores, w: CriteriaWeights = DEFAULT_WEIGHTS) => Math.round(CRITERIA.reduce((sum, c) => sum + (s[c.id] * w[c.id]) / 10, 0));

const mostCommon = (values: (string | null | undefined)[]) => {
  const count = new Map<string, number>();
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) count.set(s, (count.get(s) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

/** The distinct role titles of a population, with the context given to the model. */
export function rolesOf(people: Employee[]): (RoleInput & { people: Employee[] })[] {
  const map = new Map<string, Employee[]>();
  for (const p of people) {
    const role = roleTitle(p);
    if (!role) continue;
    const list = map.get(role);
    if (list) list.push(p);
    else map.set(role, [p]);
  }
  return [...map.entries()]
    .map(([role, list]) => ({
      role,
      n: list.length,
      people: list,
      level: mostCommon(list.map((p) => (p.level == null ? null : LevelTaxonomy.displayLabel(p.level)))),
      ccnl: mostCommon(list.map((p) => p.ccnl)),
      qualification: mostCommon(list.map((p) => p.qualification)),
      description: mostCommon(list.map((p) => p.description))?.slice(0, 300),
    }))
    .sort((a, b) => b.n - a.n || a.role.localeCompare(b.role, "it"));
}

/** Rough estimate from the CCNL level and keywords of the title (used until a weighting is saved). */
export function estimateScores(role: string, people: Employee[]): RoleScores {
  const g = JobGradingAnalyzer.gradeRole(role, people, people[0]?.level);
  return normalizeScores({
    competenze: (g.competenze / 28) * 10,
    responsabilita: (g.responsabilita / 42) * 10,
    impegno: (g.impegno / 16) * 10,
    condizioni: (g.condizioni / 10) * 10,
  });
}

/** Equal-value bands: 10 points wide, from the top. */
export const bandOf = (score: number) => Math.min(9, Math.max(0, Math.floor((score - 1) / 10)));
export const bandRange = (band: number) => [band * 10 + 1, band * 10 + 10] as const;
/** "Fascia 7 · 61–70 punti" (band 6): bands numbered from 1, higher = more value. */
export const bandName = (band: number) => `Fascia ${band + 1}`;

export interface EqualValueBand {
  band: number;
  row: ComparisonRow;
  roles: { role: string; score: number; n: number }[];
}

/** Gap per equal-value band, across the whole company (roles of different CCNL levels together). */
export function equalValueBands(people: Employee[], scoreOf: (role: string) => number | undefined, getSalary: (p: Employee) => number | null): EqualValueBand[] {
  type Entry = { people: Employee[]; roles: Map<string, { score: number; n: number }> };
  const byBand = new Map<number, Entry>();
  for (const p of people) {
    if (p.gender !== "M" && p.gender !== "F") continue;
    const role = roleTitle(p);
    const score = role ? scoreOf(role) : undefined;
    if (score == null) continue;
    const band = bandOf(score);
    const entry: Entry = byBand.get(band) ?? { people: [], roles: new Map() };
    entry.people.push(p);
    const r = entry.roles.get(role) ?? { score, n: 0 };
    r.n++;
    entry.roles.set(role, r);
    byBand.set(band, entry);
  }
  return [...byBand.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([band, e]) => {
      const [lo, hi] = bandRange(band);
      const stats = GapGroupAnalyzer.analyze(e.people, getSalary);
      return {
        band,
        row: new ComparisonRow({ ...stats, groupKey: `band-${band}`, groupLabel: `${lo}–${hi}`, people: e.people }),
        roles: [...e.roles.entries()].map(([role, r]) => ({ role, ...r })).sort((a, b) => b.score - a.score || a.role.localeCompare(b.role, "it")),
      };
    });
}

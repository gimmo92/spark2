import { Employee } from "../models/Employee";
import { SALARY_METRICS } from "../models/constants";
import { GapGroupAnalyzer, GapStats } from "./GapGroupAnalyzer";
import { LevelTaxonomy } from "./LevelTaxonomy";
import { SalaryMath } from "./SalaryMath";

const FASCIA_RANGE_SCORES = [75, 70, 65];

const FACTOR_KEYWORDS: Record<"competenze" | "responsabilita" | "impegno" | "condizioni", string[]> = {
  competenze: [
    "laurea",
    "esperto",
    "special",
    "ingegn",
    "tecnico",
    "qualif",
    "conoscenz",
    "competenz",
    "skill",
    "master",
    "certif",
  ],
  responsabilita: [
    "responsabil",
    "coordina",
    "capo",
    "manager",
    "team",
    "budget",
    "dirige",
    "lead",
    "gestione",
    "supervis",
    "quadro",
  ],
  impegno: [
    "compless",
    "analisi",
    "progett",
    "problem",
    "strateg",
    "innovaz",
    "pianific",
    "ricerca",
  ],
  condizioni: [
    "turno",
    "notte",
    "rischio",
    "impianto",
    "produzione",
    "cantiere",
    "reparto",
    "ester",
  ],
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function keywordHits(text: string, words: string[]): number {
  return words.reduce((n, w) => (text.includes(w) ? n + 1 : n), 0);
}

export class RoleGrade {
  roleKey!: string;
  roleLabel!: string;
  competenze!: number;
  responsabilita!: number;
  impegno!: number;
  condizioni!: number;
  punteggio!: number;
  nPeople!: number;
  avgPay!: number | null;
  people!: Employee[];
  rationale!: string;

  constructor(init: RoleGrade) {
    Object.assign(this, init);
  }
}

export class FasciaBand extends GapStats {
  fasciaIndex: number;
  fasciaLabel: string;
  rangeScore: number;
  nRoles: number;
  roles: RoleGrade[];
  people: Employee[];
  avgPay: number | null;

  constructor(
    init: ConstructorParameters<typeof GapStats>[0] & {
      fasciaIndex: number;
      fasciaLabel: string;
      rangeScore: number;
      nRoles: number;
      roles: RoleGrade[];
      people: Employee[];
      avgPay: number | null;
    }
  ) {
    super(init);
    this.fasciaIndex = init.fasciaIndex;
    this.fasciaLabel = init.fasciaLabel;
    this.rangeScore = init.rangeScore;
    this.nRoles = init.nRoles;
    this.roles = init.roles;
    this.people = init.people;
    this.avgPay = init.avgPay;
  }
}

export class FasciaLevelGroup {
  levelKey!: string;
  levelLabel!: string;
  sortOrder!: number;
  avgPay!: number | null;
  avgRal!: number | null;
  bands!: FasciaBand[];
  nTotal!: number;

  constructor(init: FasciaLevelGroup) {
    Object.assign(this, init);
  }
}

export class JobGradingAnalyzer {
  static splitSizes(n: number, k: number): number[] {
    if (n <= 0) return [];
    const bands = Math.max(1, Math.min(k, n));
    const base = Math.floor(n / bands);
    const rem = n % bands;
    const sizes = Array(bands).fill(base);
    const mid = Math.floor((bands - 1) / 2);
    for (let i = 0; i < rem; i++) sizes[(mid + i) % bands] += 1;
    return sizes;
  }

  static bandCount(nRoles: number): number {
    if (nRoles >= 6) return 3;
    if (nRoles >= 3) return 2;
    return 1;
  }

  static gradeRole(
    roleKey: string,
    people: Employee[],
    levelRaw: unknown
  ): RoleGrade {
    const order = LevelTaxonomy.sortOrder(levelRaw);
    const base = 38 + order * 3;
    const blob = `${roleKey} ${people.map((p) => p.description || p.role || "").join(" ")}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const cHits = keywordHits(blob, FACTOR_KEYWORDS.competenze);
    const rHits = keywordHits(blob, FACTOR_KEYWORDS.responsabilita);
    const iHits = keywordHits(blob, FACTOR_KEYWORDS.impegno);
    const kHits = keywordHits(blob, FACTOR_KEYWORDS.condizioni);

    const competenze = round1(clamp(base * 0.25 + cHits * 1.2, 6, 28));
    const responsabilita = round1(clamp(base * 0.48 + rHits * 1.5, 12, 42));
    const impegno = round1(clamp(base * 0.15 + iHits * 0.8, 3, 16));
    const condizioni = round1(clamp(base * 0.08 + kHits * 0.6, 2, 10));
    const punteggio = round1(competenze + responsabilita + impegno + condizioni);

    const pays = people
      .map((p) => p.comparisonValue(SALARY_METRICS.totale, { fte: true }))
      .filter((v): v is number => v != null);
    const avgPay = pays.length ? SalaryMath.mean(pays) : null;

    const bits = [
      `Livello CCNL (base ${base})`,
      cHits ? `competenze +${cHits}` : "",
      rHits ? `responsabilità +${rHits}` : "",
      iHits ? `impegno +${iHits}` : "",
      kHits ? `condizioni +${kHits}` : "",
    ].filter(Boolean);

    return new RoleGrade({
      roleKey,
      roleLabel: roleKey,
      competenze,
      responsabilita,
      impegno,
      condizioni,
      punteggio,
      nPeople: people.length,
      avgPay,
      people,
      rationale: bits.join(" · "),
    });
  }

  static byLevel(people: Employee[]): FasciaLevelGroup[] {
    const levelMap = new Map<string, Employee[]>();
    for (const p of people || []) {
      if (p.gender !== "M" && p.gender !== "F") continue;
      const ccnl = String(p.ccnl || "").trim() || "N/D";
      const levelKey = `${ccnl}::${LevelTaxonomy.normalize(p.level) || "N/D"}`;
      const bucket = levelMap.get(levelKey);
      if (bucket) bucket.push(p);
      else levelMap.set(levelKey, [p]);
    }

    return Array.from(levelMap.entries())
      .map(([levelKey, levelPeople]) => {
        const roleMap = new Map<string, Employee[]>();
        for (const p of levelPeople) {
          const roleKey = String(p.role ?? "").trim() || "N/D";
          const bucket = roleMap.get(roleKey);
          if (bucket) bucket.push(p);
          else roleMap.set(roleKey, [p]);
        }

        const roles = Array.from(roleMap.entries())
          .map(([roleKey, rolePeople]) =>
            JobGradingAnalyzer.gradeRole(roleKey, rolePeople, levelKey)
          )
          .sort((a, b) => b.punteggio - a.punteggio || a.roleKey.localeCompare(b.roleKey, "it"));

        const k = JobGradingAnalyzer.bandCount(roles.length);
        const sizes = JobGradingAnalyzer.splitSizes(roles.length, k);
        const bands: FasciaBand[] = [];
        let offset = 0;
        sizes.forEach((size, i) => {
          const slice = roles.slice(offset, offset + size);
          offset += size;
          const bandPeople = slice.flatMap((r) => r.people);
          const getPay = (p: Employee) =>
            p.comparisonValue(SALARY_METRICS.totale, { fte: true });
          const stats = GapGroupAnalyzer.analyze(bandPeople, getPay);
          const pays = bandPeople
            .map(getPay)
            .filter((v): v is number => v != null);
          bands.push(
            new FasciaBand({
              ...stats,
              fasciaIndex: i + 1,
              fasciaLabel: `Fascia ${i + 1}`,
              rangeScore: FASCIA_RANGE_SCORES[i] ?? FASCIA_RANGE_SCORES[FASCIA_RANGE_SCORES.length - 1],
              nRoles: slice.length,
              roles: slice.sort((a, b) =>
                String(a.roleKey).localeCompare(String(b.roleKey), "it", { numeric: true })
              ),
              people: bandPeople,
              avgPay: pays.length ? SalaryMath.mean(pays) : null,
            })
          );
        });

        const getTotal = (p: Employee) =>
          p.comparisonValue(SALARY_METRICS.totale, { fte: true });
        const getRal = (p: Employee) =>
          p.comparisonValue(SALARY_METRICS.base, { fte: true });
        const totals = levelPeople.map(getTotal).filter((v): v is number => v != null);
        const rals = levelPeople.map(getRal).filter((v): v is number => v != null);

        return new FasciaLevelGroup({
          levelKey,
          levelLabel: levelKey.includes("::")
            ? `${levelKey.split("::")[0]} · ${LevelTaxonomy.displayLabel(levelKey.split("::")[1])}`
            : LevelTaxonomy.displayLabel(levelKey),
          sortOrder: LevelTaxonomy.sortOrder(levelKey),
          avgPay: totals.length ? SalaryMath.mean(totals) : null,
          avgRal: rals.length ? SalaryMath.mean(rals) : null,
          bands,
          nTotal: levelPeople.length,
        });
      })
      .sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0));
  }
}

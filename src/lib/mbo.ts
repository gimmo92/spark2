import type { User } from "./data";

export type SchedaStatus = "bozza" | "in_approvazione" | "approvata" | "consuntivata" | "archiviata";

export interface Objective {
  id: string;
  title: string;
  weight: number; // % of the scheda, all weights sum to 100
  achieved: number; // 0-100 % of target reached
}

export interface Scheda {
  id: string;
  userId: string;
  year: number;
  title: string;
  status: SchedaStatus;
  objectives: Objective[];
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

export const YEARS = [2026, 2025, 2024];

const OBJECTIVES = [
  "Riduzione scarti di produzione",
  "Fatturato area di competenza",
  "Customer satisfaction (NPS)",
  "Rispetto tempi di consegna",
  "Riduzione infortuni sul lavoro",
  "Completamento piano formazione",
  "Riduzione costi energetici",
  "Margine operativo di reparto",
  "Nuovi clienti acquisiti",
  "Efficienza OEE impianti",
  "Riduzione giacenze di magazzino",
  "Digitalizzazione processi",
];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Weighted score of a scheda: sum(weight * achieved) / 100, rounded. */
export const schedaScore = (s: Pick<Scheda, "objectives">) =>
  Math.round(s.objectives.reduce((a, o) => a + (o.weight * Math.min(o.achieved, 100)) / 100, 0));

export function buildSeedSchede(users: User[]): Scheda[] {
  const rand = rng(7);
  const people = users.filter((u) => u.status === "attivo").slice(0, 46);
  const out: Scheda[] = [];
  people.forEach((u, i) => {
    const years = i % 3 === 0 ? [2026, 2025] : [2026];
    years.forEach((year) => {
      const n = 3 + Math.floor(rand() * 3);
      const picks = [...OBJECTIVES].sort(() => rand() - 0.5).slice(0, n);
      const base = Math.floor(100 / n);
      const status: SchedaStatus =
        year === 2025
          ? rand() < 0.25
            ? "archiviata"
            : "consuntivata"
          : (["bozza", "in_approvazione", "approvata", "approvata"] as SchedaStatus[])[Math.floor(rand() * 4)];
      const objectives = picks.map((title, k) => ({
        id: `o${i}-${year}-${k}`,
        title,
        weight: k === 0 ? 100 - base * (n - 1) : base,
        achieved:
          status === "bozza" || status === "in_approvazione"
            ? 0
            : year === 2025
              ? 50 + Math.floor(rand() * 60)
              : Math.floor(rand() * 85),
      }));
      out.push({
        id: `s${i + 1}-${year}`,
        userId: u.id,
        year,
        title: `MBO ${year} · ${u.role}`,
        status,
        objectives,
        updatedAt: `${year}-${String(1 + Math.floor(rand() * 10)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 27)).padStart(2, "0")}`,
      });
    });
  });
  return out;
}

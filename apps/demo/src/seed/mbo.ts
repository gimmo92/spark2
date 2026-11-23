// Demo MBO data for Valmec S.p.A.
import {
  catalogById,
  cycleYear,
  newTask,
  type CalcMode,
  type ObjectiveDef,
  type Preset,
  type Scheda,
  type SchedaStatus,
  type TaskType,
  type Workflow,
  type WorkflowTask,
} from "@spark/mbo";
import type { User } from "@spark/core";

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

/** Reusable target → payout scheme that can be applied to objectives. */
export const SEED_PRESETS: Preset[] = [
  {
    id: "pr-standard",
    name: "Standard 80 / 100 / 120",
    description: "Curva lineare classica: soglia all'80% del target, massimo al 120%.",
    calc: "lineare",
    levels: [
      { target: 80, payout: 50 },
      { target: 100, payout: 100 },
      { target: 120, payout: 150 },
    ],
  },
  {
    id: "pr-scaglioni",
    name: "Scaglioni 90 / 100 / 110",
    description: "Payout a gradini, nessuna interpolazione tra i livelli.",
    calc: "scaglioni",
    levels: [
      { target: 90, payout: 50 },
      { target: 100, payout: 100 },
      { target: 110, payout: 120 },
    ],
  },
  {
    id: "pr-onoff",
    name: "On / Off",
    description: "Tutto o niente: paga il 100% solo al raggiungimento del target.",
    calc: "scaglioni",
    levels: [{ target: 100, payout: 100 }],
  },
  {
    id: "pr-accelerato",
    name: "Accelerato commerciale",
    description: "Pendenza ridotta sotto target, accelerata oltre il target.",
    calc: "lineare",
    levels: [
      { target: 90, payout: 25 },
      { target: 100, payout: 100 },
      { target: 115, payout: 200 },
    ],
  },
];

const t = (type: TaskType, patch: Partial<WorkflowTask>, id: string): WorkflowTask => ({ ...newTask(type), ...patch, id });

export const SEED_WORKFLOWS: Workflow[] = [
  {
    id: "wf-standard-2026",
    name: "MBO 2026 · Standard",
    description: "Processo annuale per tutti i dipendenti con scheda MBO.",
    cycle: "2026",
    status: "attivo",
    companies: [],
    updatedAt: "2026-01-10",
    tasks: [
      t("definizione", { dueDate: "2026-01-31" }, "s1"),
      t("approvazione", { dueDate: "2026-02-15" }, "s2"),
      t("lettera", { title: "Invio lettera obiettivi", dueDate: "2026-02-28" }, "s3"),
      t("consuntivazione", { dueDate: "2027-01-31", requireEvidence: true }, "s4"),
      t(
        "lettera",
        { title: "Lettera premio", letterTemplate: "lt-premio", signers: ["dipendente", "direzione"], dueDate: "2027-02-28" },
        "s5",
      ),
    ],
  },
  {
    id: "wf-commerciale-2026",
    name: "MBO Commerciale 2026",
    description: "Forza vendita: obiettivi definiti dalla Direzione, consuntivo semestrale.",
    cycle: "2026",
    status: "attivo",
    companies: ["Valmec S.p.A.", "Valmec France SAS"],
    updatedAt: "2026-01-20",
    tasks: [
      t("definizione", { owner: "direzione", dueDate: "2026-01-20" }, "c1"),
      t("approvazione", { owner: "direzione", approvers: ["direzione"], approvalMode: "almeno_uno", dueDate: "2026-01-31" }, "c2"),
      t("consuntivazione", { title: "Consuntivo primo semestre", dueDate: "2026-07-15" }, "c3"),
      t("consuntivazione", { title: "Consuntivo secondo semestre", dueDate: "2027-01-15" }, "c4"),
      t("lettera", { title: "Lettera premio", letterTemplate: "lt-premio", dueDate: "2027-02-15" }, "c5"),
    ],
  },
  {
    id: "wf-asia-2026",
    name: "MBO Asia Pacific 2026",
    description: "Bozza in revisione con HR locale.",
    cycle: "2026",
    status: "bozza",
    companies: ["Valmec Asia Pacific Sdn Bhd"],
    updatedAt: "2026-02-02",
    tasks: [t("definizione", { owner: "hr", dueDate: "2026-03-15" }, "a1"), t("approvazione", { dueDate: "2026-03-31" }, "a2")],
  },
  {
    id: "wf-standard-2025",
    name: "MBO 2025 · Standard",
    description: "Ciclo chiuso.",
    cycle: "2025",
    status: "archiviato",
    companies: [],
    updatedAt: "2026-02-28",
    tasks: [
      t("definizione", { dueDate: "2025-01-31" }, "o1"),
      t("approvazione", { dueDate: "2025-02-15" }, "o2"),
      t("consuntivazione", { dueDate: "2026-01-31" }, "o3"),
      t("lettera", { title: "Lettera premio", letterTemplate: "lt-premio", dueDate: "2026-02-28" }, "o4"),
    ],
  },
];

/** First task whose due date is today or later. */

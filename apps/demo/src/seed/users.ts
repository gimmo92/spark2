// Demo organisation (Valmec S.p.A.): invented people, teams and companies.
import { slugEmail, type AccessLevel, type User } from "@spark/core";

export const EMAIL_DOMAIN = "tryspark.co";

export const TEAM_NAMES = ["Direzione Italia", "Engineering India", "Sales Asia Pacific", "Service Australia", "Commerciale Francia", "Produzione Italia"];

export const COMPANIES = ["Valmec S.p.A.", "Valmec Engineering India Pvt Ltd", "Valmec Asia Pacific Sdn Bhd", "Valmec Australia Pty Ltd", "Valmec France SAS"];

const TEAM_COMPANY: Record<string, string> = {
  "Direzione Italia": "Valmec S.p.A.",
  "Engineering India": "Valmec Engineering India Pvt Ltd",
  "Sales Asia Pacific": "Valmec Asia Pacific Sdn Bhd",
  "Service Australia": "Valmec Australia Pty Ltd",
  "Commerciale Francia": "Valmec France SAS",
  "Produzione Italia": "Valmec S.p.A.",
};

/** Old team names → current ones (applied to data saved before the rename). */
const TEAM_RENAMES: Record<string, string> = {
  "GROUPE A": "Direzione Italia",
  "GROUPE B1 - INDIA": "Engineering India",
  "GROUPE B1 - SOUTH EAST ASIA": "Sales Asia Pacific",
  "GROUPE B1 - AUSTRALIA": "Service Australia",
  "GROUPE B1 - FRANCE": "Commerciale Francia",
  "GROUPE B2 - ITALY": "Produzione Italia",
};

/** Returns the same array when nothing changes, so unchanged users aren't re-saved. */
export function migrateTeams(users: User[]): User[] {
  if (!users.some((u) => TEAM_RENAMES[u.team])) return users;
  return users.map((u) => (TEAM_RENAMES[u.team] ? { ...u, team: TEAM_RENAMES[u.team] } : u));
}

/** Demo reporting lines: everyone who isn't a manager reports to a manager of their team. */
export function assignManagers(users: User[]): User[] {
  if (users.some((u) => u.managerId)) return users;
  const byTeam = new Map<string, User[]>();
  for (const u of users) if (u.level === "MANAGER" && u.status === "attivo" && u.team) byTeam.set(u.team, [...(byTeam.get(u.team) ?? []), u]);
  let i = 0;
  return users.map((u) => {
    const managers = byTeam.get(u.team);
    if (u.level !== "UTENTE" || !managers?.length) return u;
    return { ...u, managerId: managers[i++ % managers.length].id };
  });
}

/** Upgrades for demo users saved with an older shape. */
export const migrateUsers = (users: User[]) => assignManagers(migrateTeams(users));

/** Business units span companies: each team belongs to one. */
export const BUSINESS_UNITS = [{ name: "Corporate", company: "Valmec S.p.A." }, { name: "Operations" }, { name: "Commercial" }];

const TEAM_BU: Record<string, string> = {
  "Direzione Italia": "Corporate",
  "Engineering India": "Operations",
  "Produzione Italia": "Operations",
  "Service Australia": "Operations",
  "Sales Asia Pacific": "Commercial",
  "Commerciale Francia": "Commercial",
};

export const TEAMS = TEAM_NAMES.map((name) => ({ name, company: TEAM_COMPANY[name], bu: TEAM_BU[name] }));

export const companyForTeam = (team: string) => TEAM_COMPANY[team] ?? COMPANIES[0];

const ROLES = [
  "Manager - Technical & Customer Support",
  "Sr.Accounts Executive",
  "Manufacturing Engineering Coordinator",
  "Technical Sales Support Engineer",
  "Head of Segment Recycling & Water Treatment",
  "Manufacturing Plant Manager",
  "Draftsman Engineering",
  "ACs Controller",
  "Fitter",
  "Account Manager",
  "Production Dept. Supervisor",
  "Assembly Dept. Supervisor",
  "Quality Control Specialist",
  "HR Business Partner",
  "Procurement Specialist",
  "Field Service Engineer",
  "Logistics Coordinator",
  "R&D Engineer",
  "Financial Controller",
  "Maintenance Technician",
  "Sales Area Manager",
  "Project Engineer",
  "Health & Safety Officer",
  "Warehouse Operator",
];

// Hand-picked demo rows shown first in the list (fictional people).
const SEED: Array<[string, string, AccessLevel, string, string]> = [
  ["Aurelio", "Abbondanza", "UTENTE", "Engineering India", ROLES[0]],
  ["Marta", "Acquaviva", "UTENTE", "Engineering India", ROLES[1]],
  ["Tommaso", "Adornetti", "UTENTE", "Direzione Italia", ROLES[2]],
  ["Fabrizio", "Agostinelli", "UTENTE", "Sales Asia Pacific", ROLES[3]],
  ["Saverio", "Alboreto", "MANAGER", "Produzione Italia", ROLES[4]],
  ["Ludovica", "Albertazzi", "MANAGER", "Direzione Italia", ROLES[5]],
  ["Corrado", "Alderisi", "UTENTE", "Service Australia", ROLES[6]],
  ["Beatrice", "Amorevole", "UTENTE", "Direzione Italia", ROLES[7]],
  ["Ivano", "Ardenghi", "UTENTE", "Commerciale Francia", ROLES[8]],
  ["Ginevra", "Arpinelli", "UTENTE", "Produzione Italia", ROLES[9]],
  ["Ettore", "Ascanelli", "UTENTE", "Direzione Italia", ROLES[10]],
  ["Noemi", "Astorrino", "UTENTE", "Direzione Italia", ROLES[11]],
];

const FIRST = [
  "Marco",
  "Giulia",
  "Luca",
  "Francesca",
  "Matteo",
  "Chiara",
  "Andrea",
  "Sara",
  "Davide",
  "Valentina",
  "Simone",
  "Martina",
  "Federico",
  "Elena",
  "Stefano",
  "Paola",
  "Riccardo",
  "Silvia",
  "Lorenzo",
  "Anna",
  "Alessio",
  "Irene",
  "Gabriele",
  "Camilla",
  "Nicola",
  "Alice",
  "Pietro",
  "Serena",
  "Filippo",
  "Laura",
  "Giacomo",
  "Elisa",
  "Emanuele",
  "Roberta",
  "Daniele",
  "Federica",
  "Massimo",
  "Ilaria",
  "Giorgio",
  "Monica",
];
const LAST = [
  "Bianchi",
  "Romano",
  "Colombo",
  "Ricci",
  "Marino",
  "Greco",
  "Bruno",
  "Gallo",
  "Conti",
  "De Luca",
  "Mancini",
  "Costa",
  "Giordano",
  "Rizzo",
  "Lombardi",
  "Moretti",
  "Barbieri",
  "Fontana",
  "Santoro",
  "Mariani",
  "Rinaldi",
  "Caruso",
  "Ferrara",
  "Galli",
  "Martini",
  "Leone",
  "Longo",
  "Gentile",
  "Martinelli",
  "Vitale",
  "Benedetti",
  "Pellegrini",
  "Serra",
  "Ferri",
  "Fabbri",
  "Villa",
  "Cattaneo",
  "Testa",
  "Parisi",
  "Sala",
  "Bellini",
  "Marchetti",
  "Guerra",
  "Sartori",
  "Grasso",
  "Monti",
  "Silvestri",
  "Orlando",
  "Neri",
  "Valentini",
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDaysAgo(days: number) {
  const d = new Date(Date.UTC(2026, 10, 20));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function buildSeedUsers(): User[] {
  const rand = mulberry32(42);
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const users: User[] = [];
  const emails = new Set<string>();

  SEED.forEach(([firstName, lastName, level, team, role], i) => {
    const email = slugEmail(firstName, lastName, EMAIL_DOMAIN);
    emails.add(email);
    users.push({
      id: `u${i + 1}`,
      firstName,
      lastName,
      email,
      level,
      team,
      company: companyForTeam(team),
      role,
      status: "attivo",
      createdAt: isoDaysAgo(200 + i * 13),
    });
  });

  // 341 active + 29 deactivated
  const total = 370;
  let n = users.length;
  while (users.length < total) {
    const firstName = pick(FIRST);
    const lastName = pick(LAST);
    let email = slugEmail(firstName, lastName, EMAIL_DOMAIN);
    let k = 2;
    while (emails.has(email)) email = email.replace(/(\d*)@/, `${k++}@`);
    emails.add(email);
    const r = rand();
    n++;
    const team = pick(TEAM_NAMES);
    users.push({
      id: `u${n}`,
      firstName,
      lastName,
      email,
      level: r < 0.03 ? "ADMIN" : r < 0.18 ? "MANAGER" : "UTENTE",
      team: rand() < 0.04 ? "" : team,
      company: companyForTeam(team),
      role: pick(ROLES),
      status: users.length >= 341 ? "disattivato" : "attivo",
      createdAt: isoDaysAgo(Math.floor(rand() * 900)),
    });
  }
  return assignManagers(users);
}

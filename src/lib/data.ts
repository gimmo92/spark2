export type AccessLevel = "UTENTE" | "MANAGER" | "ADMIN";
export type AccountStatus = "attivo" | "disattivato";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  level: AccessLevel;
  team: string;
  company: string;
  role: string;
  status: AccountStatus;
  createdAt: string; // ISO date
}

export const ACCESS_LEVELS: AccessLevel[] = ["UTENTE", "MANAGER", "ADMIN"];

export const TEAMS = [
  "GROUPE A",
  "GROUPE B1 - INDIA",
  "GROUPE B1 - SOUTH EAST ASIA",
  "GROUPE B1 - AUSTRALIA",
  "GROUPE B1 - FRANCE",
  "GROUPE B2 - ITALY",
];

export const COMPANIES = [
  "Rossi S.p.A.",
  "Rossi India Pvt Ltd",
  "Rossi Asia Sdn Bhd",
  "Rossi Australia Pty",
  "Rossi France SAS",
];

const TEAM_COMPANY: Record<string, string> = {
  "GROUPE A": "Rossi S.p.A.",
  "GROUPE B1 - INDIA": "Rossi India Pvt Ltd",
  "GROUPE B1 - SOUTH EAST ASIA": "Rossi Asia Sdn Bhd",
  "GROUPE B1 - AUSTRALIA": "Rossi Australia Pty",
  "GROUPE B1 - FRANCE": "Rossi France SAS",
  "GROUPE B2 - ITALY": "Rossi S.p.A.",
};

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
  ["Aurelio", "Abbondanza", "UTENTE", "GROUPE B1 - INDIA", ROLES[0]],
  ["Meera", "Acharvani", "UTENTE", "GROUPE B1 - INDIA", ROLES[1]],
  ["Tommaso", "Adornetti", "UTENTE", "GROUPE A", ROLES[2]],
  ["Farid", "Adzlan Rahimi", "UTENTE", "GROUPE B1 - SOUTH EAST ASIA", ROLES[3]],
  ["Samir", "Al-Qasrawi", "MANAGER", "GROUPE B2 - ITALY", ROLES[4]],
  ["Ludovica", "Albertazzi", "MANAGER", "GROUPE A", ROLES[5]],
  ["Callum", "Alderwick", "UTENTE", "GROUPE B1 - AUSTRALIA", ROLES[6]],
  ["Beatrice", "Amorevole", "UTENTE", "GROUPE A", ROLES[7]],
  ["Yanis", "Ardouane", "UTENTE", "GROUPE B1 - FRANCE", ROLES[8]],
  ["Ginevra", "Arpinelli", "UTENTE", "GROUPE B2 - ITALY", ROLES[9]],
  ["Ettore", "Ascanelli", "UTENTE", "GROUPE A", ROLES[10]],
  ["Noemi", "Astorrino", "UTENTE", "GROUPE A", ROLES[11]],
];

const FIRST = [
  "Marco", "Giulia", "Luca", "Francesca", "Matteo", "Chiara", "Andrea", "Sara", "Davide", "Valentina",
  "Simone", "Martina", "Federico", "Elena", "Stefano", "Paola", "Riccardo", "Silvia", "Lorenzo", "Anna",
  "Priya", "Rahul", "Arjun", "Deepa", "Wei Ming", "Siti", "Hafiz", "Nurul", "Jack", "Olivia",
  "Liam", "Chloe", "Pierre", "Camille", "Julien", "Léa", "Mohamed", "Nadia", "Giorgio", "Roberta",
];
const LAST = [
  "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca",
  "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani",
  "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone", "Longo", "Gentile", "Martinelli", "Vitale",
  "Sharma", "Patel", "Iyer", "Tan", "Lim", "Yusof", "Smith", "Wilson", "Dubois", "Lefèvre",
  "Bernard", "Pellegrini", "Serra", "Ferri", "Fabbri", "Villa", "Cattaneo", "Testa", "Parisi", "Sala",
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

export function slugEmail(first: string, last: string) {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  const f = clean(first.split(" ")[0]);
  const l = clean(last);
  return `${f}.${l}@rossi.com`;
}

function isoDaysAgo(days: number) {
  const d = new Date(Date.UTC(2026, 10, 20));
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function buildSeedUsers(): User[] {
  const rand = mulberry32(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const users: User[] = [];
  const emails = new Set<string>();

  SEED.forEach(([firstName, lastName, level, team, role], i) => {
    const email = slugEmail(firstName, lastName);
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
    let email = slugEmail(firstName, lastName);
    let k = 2;
    while (emails.has(email)) email = email.replace(/(\d*)@/, `${k++}@`);
    emails.add(email);
    const r = rand();
    n++;
    const team = pick(TEAMS);
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
  return users;
}

export const fullName = (u: Pick<User, "firstName" | "lastName">) => `${u.firstName} ${u.lastName}`;

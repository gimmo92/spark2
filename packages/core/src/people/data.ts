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

/** nome.cognome@domain, accents and spaces removed. */
export function slugEmail(first: string, last: string, domain: string) {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  const f = clean(first.split(" ")[0]);
  const l = clean(last);
  return `${f}.${l}@${domain}`;
}

export const fullName = (u: Pick<User, "firstName" | "lastName">) => `${u.firstName} ${u.lastName}`;

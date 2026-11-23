/** Id of an access level: "ADMIN", "MANAGER", "UTENTE" or a custom level (Impostazioni → Permessi). */
export type AccessLevel = string;
export type AccountStatus = "attivo" | "disattivato";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  level: AccessLevel;
  /** Direct manager (user id): defines "riporti" for permissions. */
  managerId?: string;
  team: string;
  company: string;
  role: string;
  status: AccountStatus;
  createdAt: string; // ISO date
}

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

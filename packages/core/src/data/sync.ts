/** Shared between the client data store and /api/data. */
import type { Doc } from "../config";

export interface DataChanges {
  upserts?: Record<string, Doc[]>;
  deletes?: Record<string, string[]>;
}

/** The logged-in user as resolved by /api/data. */
export interface ViewerDTO {
  email: string;
  /** Matching record of the "users" collection. */
  userId?: string;
  level: string;
  isAdmin: boolean;
}

/** Where the data lives right now ("denied" = logged in but not allowed to see any data). */
export type DataSource = "loading" | "db" | "local" | "denied";

/** Messages for /api/data errors (shown in the banner when the app falls back to the browser). */
export const DATA_ERRORS: Record<string, string> = {
  config: "Database non configurato: i dati restano solo in questo browser.",
  table: "Tabella app_data mancante su Supabase (esegui le migrazioni): i dati restano solo in questo browser.",
  unauthenticated: "Non hai effettuato l'accesso: i dati restano solo in questo browser. Accedi per salvarli nel database.",
  forbidden: "Il tuo account non può modificare i dati: le modifiche restano solo in questo browser.",
  network: "Database non raggiungibile: i dati restano solo in questo browser.",
  unlinked:
    "Il tuo account non è collegato a nessun utente di Spark: chiedi a un amministratore di aggiungerti alla Lista Utenti con questa email.",
};

/**
 * Items whose reference changed (upsert) or disappeared (delete) between two snapshots.
 * State updates are immutable, so a changed record is a new object.
 */
export function diffById<T extends Doc>(prev: T[], next: T[]) {
  if (prev === next) return { upserts: [] as T[], deletes: [] as string[] };
  const before = new Map(prev.map((x) => [x.id, x]));
  const upserts = next.filter((x) => before.get(x.id) !== x);
  const keep = new Set(next.map((x) => x.id));
  const deletes = prev.filter((x) => !keep.has(x.id)).map((x) => x.id);
  return { upserts, deletes };
}

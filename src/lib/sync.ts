/** Shared between the client store and /api/data. */
export const COLLECTIONS = ["users", "schede", "objectives", "presets", "workflows", "settings"] as const;
export type Collection = (typeof COLLECTIONS)[number];

export interface DataChanges {
  upserts?: Partial<Record<Collection, Array<{ id: string }>>>;
  deletes?: Partial<Record<Collection, string[]>>;
}

/** Where the data lives right now. */
export type DataSource = "loading" | "db" | "local";

/** Messages for /api/data errors (shown in the banner when the app falls back to the browser). */
export const DATA_ERRORS: Record<string, string> = {
  config: "Database non configurato: i dati restano solo in questo browser.",
  table: "Tabella app_data mancante su Supabase (esegui supabase/app_data.sql): i dati restano solo in questo browser.",
  unauthenticated: "Non hai effettuato l'accesso: i dati restano solo in questo browser. Accedi per salvarli nel database.",
  forbidden: "Il tuo account non può modificare i dati: le modifiche restano solo in questo browser.",
  network: "Database non raggiungibile: i dati restano solo in questo browser.",
};

/**
 * Items whose reference changed (upsert) or disappeared (delete) between two snapshots.
 * State updates in the store are immutable, so a changed record is a new object.
 */
export function diffById<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((x) => [x.id, x]));
  const upserts = next.filter((x) => before.get(x.id) !== x);
  const keep = new Set(next.map((x) => x.id));
  const deletes = prev.filter((x) => !keep.has(x.id)).map((x) => x.id);
  return { upserts, deletes };
}

/** Shared between the "Aziende" page and /api/tenants (multi-tenant apps only). */
export interface TenantDTO {
  id: string;
  name: string;
  plan: string;
  created_at: string;
  /** Number of user records in the tenant. */
  users: number;
}

/** Messages for errors returned by /api/tenants. */
export const TENANT_ERRORS: Record<string, string> = {
  config: "Aziende non disponibili: esegui su Supabase le migrazioni multi-tenant.",
  email_config: "Invio email non configurato: imposta SENDGRID_API_KEY e SENDGRID_FROM.",
  unauthenticated: "Accedi con password e codice.",
  forbidden: "Solo lo staff Spark gestisce le aziende.",
  name: "Inserisci il nome dell'azienda.",
  person: "Inserisci nome e cognome dell'amministratore.",
  email: "Indirizzo email non valido.",
  taken: "Questa email è già usata da un'altra azienda.",
  missing: "Azienda non trovata.",
  send: "Azienda creata, ma l'email di invito non è partita: reinviala dalla Lista Utenti.",
};

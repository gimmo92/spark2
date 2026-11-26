export interface InviteDTO {
  email: string;
  code: string;
  sent_at: string;
  registered_at: string | null;
}

export type InvitesStatus = "loading" | "ready" | "unavailable";

/** Messages for errors returned by /api/invites. */
export const INVITE_ERRORS: Record<string, string> = {
  config: "Inviti non disponibili: collega Supabase e crea la tabella registration_invites.",
  email_config: "Invio email non configurato: imposta SENDGRID_API_KEY e SENDGRID_FROM.",
  unauthenticated: "Accedi con password e codice per gestire gli inviti.",
  forbidden: "Il tuo livello di accesso non permette di invitare utenti.",
  registered: "L'utente è già registrato.",
  other_tenant: "Questa email è già usata da un'altra azienda.",
  send: "SendGrid non ha accettato l'email. Controlla mittente e API key.",
  email: "Indirizzo email non valido.",
};

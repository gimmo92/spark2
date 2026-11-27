/** Shared between the Spark panel and /api/spark. */
export interface SparkPanelDTO {
  /** Every module built into the app. */
  modules: { id: string; label: string }[];
  /** Modules switched on for the whole installation. */
  installation: string[];
  multiTenant: boolean;
  /** Multi-tenant apps: modules chosen for each company (companies missing here use the default). */
  tenantModules: Record<string, string[]>;
  /** `SparkConfig.tenantModules`: what a company gets until staff choose (undefined = the installation's). */
  tenantDefault?: string[];
  /** Menu entries (hrefs) switched off for the installation / for each company. */
  installationHidden: string[];
  tenantHidden: Record<string, string[]>;
}

export const PANEL_ERRORS: Record<string, string> = {
  config: "Database non configurato.",
  table: "Database non aggiornato: esegui le migrazioni del core (0003) su Supabase.",
  forbidden: "Pannello riservato al team Spark.",
  unauthenticated: "Accedi per usare il pannello.",
  missing: "Azienda non trovata.",
  body: "Richiesta non valida.",
};

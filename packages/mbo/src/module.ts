import { OTHERS_SCOPES, SCOPES, type Doc, type PermissionDef, type SparkModule } from "@spark/core";
import { mboLetters } from "./lib/letters";
import type { MboOptions } from "./lib/mbo";
import { EN } from "./i18n/en";

const G = "MBO";

/** Permissions of the MBO module (Impostazioni → Permessi). Ids are stored in levels: never rename. */
export const MBO_PERMISSIONS: PermissionDef[] = [
  {
    id: "mbo.schede.view",
    group: G,
    label: "Vedere le schede obiettivo",
    scopes: SCOPES,
    defaults: { MANAGER: ["self", "reports", "team"], UTENTE: ["self"] },
  },
  {
    id: "mbo.schede.edit",
    group: G,
    label: "Creare e modificare le schede obiettivo",
    hint: "Assegnatario, ciclo, stato della scheda",
    scopes: OTHERS_SCOPES,
    defaults: { MANAGER: ["reports"] },
  },
  {
    id: "mbo.goals.edit",
    group: G,
    label: "Modificare gli obiettivi nelle schede",
    hint: "Aggiungere o togliere obiettivi, pesi e livelli target / payout",
    scopes: SCOPES,
    defaults: { MANAGER: ["reports"] },
  },
  {
    id: "mbo.results.edit",
    group: G,
    label: "Inserire i consuntivi",
    scopes: SCOPES,
    defaults: { MANAGER: ["reports"] },
  },
  {
    id: "mbo.schede.approve",
    group: G,
    label: "Approvare le schede obiettivo",
    scopes: OTHERS_SCOPES,
    defaults: { MANAGER: ["reports"] },
  },
  {
    id: "mbo.forecast.view",
    group: G,
    label: "Vedere il forecast",
    scopes: OTHERS_SCOPES,
    defaults: { MANAGER: ["reports", "team"] },
  },
  {
    id: "mbo.dashboard.view",
    group: G,
    label: "Vedere la dashboard MBO",
    scopes: OTHERS_SCOPES,
    defaults: { MANAGER: ["reports", "team"] },
  },
  { id: "mbo.catalog.manage", group: G, label: "Gestire il catalogo obiettivi" },
  { id: "mbo.workflow.manage", group: G, label: "Gestire i workflow" },
  { id: "mbo.settings.manage", group: G, label: "Modificare le impostazioni MBO", hint: "Soglia globale, preset target / payout" },
];

/** Any of these lets a user change a scheda (the editor then limits what each one allows). */
export const SCHEDA_EDIT = ["mbo.schede.edit", "mbo.goals.edit", "mbo.results.edit", "mbo.schede.approve"];

/** MBO module: schede obiettivo, catalogo obiettivi, preset, workflow (settings doc "mbo"). */
const baseModule: SparkModule = {
  id: "mbo",
  label: "MBO",
  collections: ["schede", "objectives", "presets", "workflows"],
  permissions: MBO_PERMISSIONS,
  messages: { en: EN },
  // enforced by /api/data on the server
  access: {
    schede: {
      owners: (d: Doc) => (d as Doc & { assigneeIds?: string[] }).assigneeIds ?? [],
      view: "mbo.schede.view",
      edit: SCHEDA_EDIT,
    },
    objectives: { edit: ["mbo.catalog.manage"] }, // the catalog is read by every scheda
    presets: { edit: ["mbo.settings.manage"] },
    workflows: { edit: ["mbo.workflow.manage"] },
  },
  settingsAccess: { mbo: ["mbo.settings.manage"] },
  letters: mboLetters,
};

/** The MBO module with client-specific switches (see `MboOptions`). */
export const createMboModule = (options: MboOptions = {}): SparkModule => ({ ...baseModule, options: { ...options } });

/** The standard MBO module, no options. */
export const mboModule = createMboModule();

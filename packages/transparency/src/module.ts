import type { PermissionDef, SparkModule } from "@spark/core";
import { EN } from "./i18n/en";

const G = "Trasparenza retributiva";

/** Permissions of the pay transparency module (Impostazioni → Permessi). Ids are stored in levels: never rename. */
export const TRANSPARENCY_PERMISSIONS: PermissionDef[] = [
  {
    id: "transparency.view",
    group: G,
    label: "Vedere le analisi di trasparenza retributiva",
    hint: "Divari retributivi, report e dati dei singoli dipendenti",
  },
  {
    id: "transparency.manage",
    group: G,
    label: "Caricare e salvare le analisi di trasparenza retributiva",
    hint: "Caricare il tracciato, giustificare gli scostamenti, eliminare analisi",
  },
];

/** Collection of saved analyses (one record per analysis, with the employees' pay data). */
export const PAY_ANALYSES = "payAnalyses";

/** Job evaluation of the company's roles (one record per role title, see lib/roleWeights). */
export const ROLE_WEIGHTS = "roleWeights";

/** Pay transparency module: EU directive 2023/970 gender pay gap analysis on the Spark payroll template. */
export const transparencyModule: SparkModule = {
  id: "transparency",
  label: "Trasparenza retributiva",
  collections: [PAY_ANALYSES, ROLE_WEIGHTS],
  permissions: TRANSPARENCY_PERMISSIONS,
  messages: { en: EN },
  // pay data: readable and writable only with the module's permissions (enforced by /api/data)
  access: {
    [PAY_ANALYSES]: { view: "transparency.view", edit: ["transparency.manage"] },
    [ROLE_WEIGHTS]: { view: "transparency.view", edit: ["transparency.manage"] },
  },
};

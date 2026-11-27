import { Banknote, BookOpen, ChartColumn, Goal, Info, Settings, Star, Target } from "lucide-react";
import { companyNav, defineConfig, type Doc } from "@spark/core";
import { mboModule } from "@spark/mbo";
import { transparencyModule } from "@spark/transparency";
import { BUSINESS_UNITS, COMPANIES, TEAMS, buildSeedUsers, migrateUsers, EMAIL_DOMAIN } from "./seed/users";
import { SEED_OBJECTIVES, SEED_PRESETS, SEED_WORKFLOWS, buildSeedSchede } from "./seed/mbo";
import { LEGACY_LETTER_IDS, SEED_LETTERS } from "./seed/letters";
import type { User as SparkUser } from "@spark/core";
import type { Workflow } from "@spark/mbo";
import { EN } from "./i18n/en";

/** Demo client: Valmec S.p.A. (app.tryspark.it). Invented people and data. */
export default defineConfig({
  appName: "Spark",
  home: "/azienda/utenti",
  // English copy of this app (core and modules bring their own); users switch IT / EN from the menu
  messages: { en: EN },
  org: {
    name: "Valmec S.p.A.",
    emailDomains: [EMAIL_DOMAIN],
    companies: COMPANIES,
    businessUnits: BUSINESS_UNITS,
    teams: TEAMS,
  },
  modules: [mboModule, transparencyModule],
  nav: [
    { label: "Profilo", href: "/profilo", icon: Info },
    { label: "Dashboard", href: "/dashboard", icon: ChartColumn },
    companyNav([
      { label: "Organigramma", href: "/azienda/organigramma", locked: true },
    ]),
    {
      id: "mbo",
      label: "MBO",
      icon: Target,
      module: "mbo",
      children: [
        { label: "Schede obiettivo", href: "/mbo/schede", permission: "mbo.schede.view" },
        { label: "Obiettivi", href: "/mbo/obiettivi", permission: "mbo.catalog.manage" },
        { label: "Workflow", href: "/mbo/workflow", permission: "mbo.workflow.manage" },
        { label: "Forecast", href: "/mbo/forecast", permission: "mbo.forecast.view" },
      ],
    },
    {
      id: "compensation",
      label: "Compensation",
      icon: Banknote,
      children: [
        { label: "Caricamento dati", href: "/caricamento-dati", permission: "transparency.manage", module: "transparency" },
        { label: "Trasparenza salariale", href: "/trasparenza", permission: "transparency.view", module: "transparency" },
        { label: "Job grading", href: "/job-grading", permission: "transparency.view", module: "transparency" },
        { label: "Benchmarks", href: "/benchmarks", permission: "transparency.view", module: "transparency" },
        { label: "Salary review", href: "/salary-review", locked: true },
        { label: "Salary bands", href: "/salary-bands", permission: "transparency.view", module: "transparency" },
      ],
    },
    { label: "Competenze", href: "/competenze", icon: BookOpen, muted: true },
    { label: "Valutazioni", href: "/valutazioni", icon: Star, muted: true },
    { label: "OKR", href: "/okr", icon: Goal, muted: true },
    { label: "Impostazioni", href: "/impostazioni", icon: Settings },
  ],
  dashboardTabs: [
    { label: "Generale", href: "/dashboard", exact: true, permission: "dashboard.view" },
    { label: "MBO", href: "/dashboard/mbo", permission: "mbo.dashboard.view", module: "mbo" },
  ],
  settingsTabs: [
    { label: "Permessi", href: "/impostazioni/permessi", permission: "access.manage" },
    { label: "MBO", href: "/impostazioni/mbo", permission: "mbo.settings.manage", module: "mbo" },
  ],
  seed: () => {
    const users = buildSeedUsers();
    return {
      users,
      schede: buildSeedSchede(users),
      objectives: SEED_OBJECTIVES,
      presets: SEED_PRESETS,
      workflows: SEED_WORKFLOWS,
      letters: SEED_LETTERS,
      settings: [{ id: "mbo", globalThresholdId: "ob-ebitda" }],
    };
  },
  migrate: (collection: string, items: Doc[]) => {
    if (collection === "users") return migrateUsers(items as SparkUser[]);
    if (collection === "workflows") return migrateWorkflowLetters(items as Workflow[]);
    return items;
  },
});

/** Demo workflows saved before letter templates existed point to a label: map it to the template id. */
function migrateWorkflowLetters(items: Workflow[]): Doc[] {
  const stale = (w: Workflow) => w.tasks.some((t) => t.letterTemplate && LEGACY_LETTER_IDS[t.letterTemplate]);
  if (!items.some(stale)) return items;
  return items.map((w) =>
    stale(w)
      ? { ...w, tasks: w.tasks.map((t) => (t.letterTemplate && LEGACY_LETTER_IDS[t.letterTemplate] ? { ...t, letterTemplate: LEGACY_LETTER_IDS[t.letterTemplate] } : t)) }
      : w,
  );
}

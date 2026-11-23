import { BookOpen, ChartColumn, Goal, Info, Settings, Star, Target, User } from "lucide-react";
import { defineConfig, type Doc } from "@spark/core";
import { mboModule } from "@spark/mbo";
import { COMPANIES, TEAMS, buildSeedUsers, migrateUsers, EMAIL_DOMAIN } from "./seed/users";
import { SEED_OBJECTIVES, SEED_PRESETS, SEED_WORKFLOWS, buildSeedSchede } from "./seed/mbo";
import type { User as SparkUser } from "@spark/core";

/** Demo client: Valmec S.p.A. (app.tryspark.it). Invented people and data. */
export default defineConfig({
  appName: "Spark",
  home: "/azienda/utenti",
  org: {
    name: "Valmec S.p.A.",
    emailDomains: [EMAIL_DOMAIN],
    companies: COMPANIES,
    teams: TEAMS,
  },
  modules: [mboModule],
  nav: [
    { label: "Profilo", href: "/profilo", icon: Info },
    { label: "Dashboard", href: "/dashboard", icon: ChartColumn },
    {
      id: "azienda",
      label: "La mia azienda",
      icon: User,
      children: [
        { label: "Lista Utenti", href: "/azienda/utenti", permission: "people.view" },
        { label: "Lista Team", href: "/azienda/team", permission: "teams.manage" },
        { label: "Modifica azienda", href: "/azienda/modifica" },
        { label: "Gestione Società", href: "/azienda/societa" },
        { label: "Gestione Ruoli", href: "/azienda/ruoli" },
        { label: "Organigramma", href: "/azienda/organigramma" },
        { label: "Gestione Lettere", href: "/azienda/lettere", badge: "Beta" },
      ],
    },
    {
      id: "mbo",
      label: "MBO",
      icon: Target,
      children: [
        { label: "Schede obiettivo", href: "/mbo/schede", permission: "mbo.schede.view" },
        { label: "Obiettivi", href: "/mbo/obiettivi", permission: "mbo.catalog.manage" },
        { label: "Workflow", href: "/mbo/workflow", permission: "mbo.workflow.manage" },
        { label: "Forecast", href: "/mbo/forecast", permission: "mbo.forecast.view" },
      ],
    },
    { label: "Competenze", href: "/competenze", icon: BookOpen, muted: true },
    { label: "Valutazioni", href: "/valutazioni", icon: Star, muted: true },
    { label: "OKR", href: "/okr", icon: Goal, muted: true },
    { label: "Impostazioni", href: "/impostazioni", icon: Settings },
  ],
  dashboardTabs: [
    { label: "Generale", href: "/dashboard", exact: true, permission: "dashboard.view" },
    { label: "MBO", href: "/dashboard/mbo", permission: "mbo.dashboard.view" },
  ],
  settingsTabs: [
    { label: "Permessi", href: "/impostazioni/permessi", permission: "access.manage" },
    { label: "MBO", href: "/impostazioni/mbo", permission: "mbo.settings.manage" },
  ],
  seed: () => {
    const users = buildSeedUsers();
    return {
      users,
      schede: buildSeedSchede(users),
      objectives: SEED_OBJECTIVES,
      presets: SEED_PRESETS,
      workflows: SEED_WORKFLOWS,
      settings: [{ id: "mbo", globalThresholdId: "ob-ebitda" }],
    };
  },
  migrate: (collection: string, items: Doc[]) => (collection === "users" ? migrateUsers(items as SparkUser[]) : items),
});

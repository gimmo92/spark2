import { BookOpen, ChartColumn, Goal, Info, Settings, Star, Target, User } from "lucide-react";
import { defineConfig, type Doc } from "@spark/core";
import { mboModule } from "@spark/mbo";
import { COMPANIES, TEAMS, buildSeedUsers, migrateTeams, EMAIL_DOMAIN } from "./seed/users";
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
        { label: "Lista Utenti", href: "/azienda/utenti" },
        { label: "Lista Team", href: "/azienda/team" },
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
        { label: "Schede obiettivo", href: "/mbo/schede" },
        { label: "Obiettivi", href: "/mbo/obiettivi" },
        { label: "Workflow", href: "/mbo/workflow" },
        { label: "Forecast", href: "/mbo/forecast" },
      ],
    },
    { label: "Competenze", href: "/competenze", icon: BookOpen, muted: true },
    { label: "Valutazioni", href: "/valutazioni", icon: Star, muted: true },
    { label: "OKR", href: "/okr", icon: Goal, muted: true },
    { label: "Impostazioni", href: "/impostazioni", icon: Settings },
  ],
  dashboardTabs: [
    { label: "Generale", href: "/dashboard", exact: true },
    { label: "MBO", href: "/dashboard/mbo" },
  ],
  settingsTabs: [{ label: "MBO", href: "/impostazioni/mbo" }],
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
  migrate: (collection: string, items: Doc[]) => (collection === "users" ? migrateTeams(items as SparkUser[]) : items),
});

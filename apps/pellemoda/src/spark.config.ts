import { Banknote, ChartColumn, CloudSun, Info, Settings, Target } from "lucide-react";
import { companyNav, defineConfig } from "@spark/core";
import { createMboModule } from "@spark/mbo";
import { EN } from "./i18n/en";

/**
 * Client: Pellemoda. Only the standard MBO module.
 * Clean start: no seed data. Users, teams and MBO data are created in the app (saved on this client's Supabase).
 */
export default defineConfig({
  appName: "Spark",
  home: "/azienda/utenti",
  // English copy of this app (core and modules bring their own); users switch IT / EN from the menu
  messages: { en: EN },
  storagePrefix: "spark.pellemoda",
  org: {
    // TODO(owner): legal name, email domains, companies and teams from the client
    name: "Pellemoda",
    emailDomains: ["pellemoda.it"],
    companies: ["Pellemoda"],
    teams: [],
  },
  locale: "it",
  modules: [createMboModule()],
  nav: [
    { label: "Profilo", href: "/profilo", icon: Info },
    { label: "Dashboard", href: "/dashboard", icon: ChartColumn },
    companyNav(),
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
    // other Spark modules, not in this installation
    {
      id: "compensation",
      label: "Compensation",
      icon: Banknote,
      children: [
        { label: "Caricamento dati", href: "/caricamento-dati", locked: true },
        { label: "Trasparenza salariale", href: "/trasparenza", locked: true },
        { label: "Job grading", href: "/job-grading", locked: true },
        { label: "Benchmarks", href: "/benchmarks", locked: true },
        { label: "Salary review", href: "/salary-review", locked: true },
        { label: "Salary bands", href: "/salary-bands", locked: true },
        { label: "Minimi CCNL", href: "/minimi-ccnl", locked: true },
      ],
    },
    { label: "Analisi di clima", href: "/clima", icon: CloudSun, locked: true },
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
});

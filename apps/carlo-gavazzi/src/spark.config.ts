import { Banknote, ChartColumn, CloudSun, Info, Settings, Target } from "lucide-react";
import { companyNav, defineConfig } from "@spark/core";
import { createMboModule } from "@spark/mbo";
import { EN } from "./i18n/en";

/**
 * Client: Carlo Gavazzi Services AG.
 * Clean start: no seed data. Users, teams and MBO data are created in the app (saved on this client's Supabase).
 */
export default defineConfig({
  appName: "Spark",
  home: "/azienda/utenti",
  // English copy of this app (core and modules bring their own); users switch IT / EN from the menu
  messages: { en: EN },
  storagePrefix: "spark.cg",
  org: {
    name: "Carlo Gavazzi Services AG",
    // the group uses several domains (one per business unit): add them here as they come up
    emailDomains: ["gavazzicbu.it"],
    // only the group company of the same name, for now
    companies: ["Carlo Gavazzi Services AG"],
    // TODO(owner): teams, from the client's organisation
    teams: [],
  },
  // English by default (users switch IT / EN from the menu)
  locale: "en",
  // levels target / payout per project activity (their bonus roadmaps: milestones → payout);
  // "Visualizza" opens the Excel-like Incentive Plan calculation (src/components/IncentivePlanSheet.tsx)
  // target bonus per person, read by the Incentive Plan sheet
  userFields: [
    { key: "bonusTarget", label: "Bonus target (100%)", type: "number", placeholder: "es. 60000" },
    { key: "bonusCurrency", label: "Valuta bonus", placeholder: "CHF", upper: true, maxLength: 3 },
  ],
  // quantitative targets in % of last year's actual (e.g. minimum 90% of last year, target 108%, then 110%… of the target)
  // the forecast's on-target budget is the sum of each person's target bonus (user fields below, CHF when not set)
  modules: [
    createMboModule({
      activityLevels: true,
      relativeLevels: true,
      schedaViewHref: (id) => `/mbo/schede/${id}/calcolo`,
      bonusOf: (u) => {
        const v = u.extra?.bonusTarget;
        return v === undefined || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v);
      },
      bonusCurrencyOf: (u) => String(u.extra?.bonusCurrency || "CHF"),
    }),
  ],
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
        { label: "Trasparenza salariale", href: "/trasparenza", locked: true },
        { label: "Job grading", href: "/job-grading", locked: true },
        { label: "Benchmarks", href: "/benchmarks", locked: true },
        { label: "Salary review", href: "/salary-review", locked: true },
        { label: "Salary bands", href: "/salary-bands", locked: true },
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

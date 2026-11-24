import { ChartColumn, Info, Settings, Target, User } from "lucide-react";
import { defineConfig } from "@spark/core";
import { createMboModule } from "@spark/mbo";

/**
 * Client: Carlo Gavazzi Services AG.
 * Clean start: no seed data. Users, teams and MBO data are created in the app (saved on this client's Supabase).
 */
export default defineConfig({
  appName: "Spark",
  home: "/azienda/utenti",
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
  // levels target / payout per project activity (their bonus roadmaps: milestones → payout);
  // "Visualizza" opens the Excel-like Incentive Plan calculation (src/components/IncentivePlanSheet.tsx)
  // target bonus per person, read by the Incentive Plan sheet
  userFields: [
    { key: "bonusTarget", label: "Bonus target (100%)", type: "number", placeholder: "es. 60000" },
    { key: "bonusCurrency", label: "Valuta bonus", placeholder: "CHF", upper: true, maxLength: 3 },
  ],
  modules: [createMboModule({ activityLevels: true, schedaViewHref: (id) => `/mbo/schede/${id}/calcolo` })],
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
        { label: "Business Unit", href: "/azienda/bu", permission: "teams.manage" },
        { label: "Gestione Lettere", href: "/azienda/lettere", permission: "letters.manage" },
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
});

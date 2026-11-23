import { ChartColumn, Info, Settings, Target, User } from "lucide-react";
import { defineConfig } from "@spark/core";
import { mboModule } from "@spark/mbo";

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
    // TODO(owner): confirm the email domain used by the client's employees
    emailDomain: "carlogavazzi.com",
    companies: ["Carlo Gavazzi Services AG"],
    // TODO(owner): teams and their company, from the client's organisation
    teams: [],
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
    { label: "Impostazioni", href: "/impostazioni", icon: Settings },
  ],
  dashboardTabs: [
    { label: "Generale", href: "/dashboard", exact: true },
    { label: "MBO", href: "/dashboard/mbo" },
  ],
  settingsTabs: [{ label: "MBO", href: "/impostazioni/mbo" }],
});

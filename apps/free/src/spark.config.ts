import { BookOpen, ChartColumn, Goal, Info, Scale, Settings, Star, Target, User } from "lucide-react";
import { defineConfig } from "@spark/core";
import { transparencyModule } from "@spark/transparency";
import { EN } from "./i18n/en";

/**
 * Spark Free (free.tryspark.it): several companies share this app (multi-tenant). Spark staff create
 * each company from the "Aziende" page and invite its first admin; companies only use the pay
 * transparency module. A company that buys Spark moves to its own app (scripts/migrate-tenant).
 */
export default defineConfig({
  appName: "Spark",
  multiTenant: true,
  home: "/trasparenza",
  messages: { en: EN },
  // the rest of Spark is shown locked: what a company gets when it moves to a paid plan
  lockedHint: "Non incluso nel piano Free: scrivici per attivarlo",
  // per-tenant: the company name comes from the settings document "org" written when the tenant is created
  org: { name: "Spark", emailDomains: [], companies: [], teams: [] },
  modules: [transparencyModule],
  nav: [
    { label: "Trasparenza retributiva", href: "/trasparenza", icon: Scale, permission: "transparency.view" },
    { label: "Profilo", href: "/profilo", icon: Info },
    { label: "Dashboard", href: "/dashboard", icon: ChartColumn, locked: true },
    {
      id: "azienda",
      label: "La mia azienda",
      icon: User,
      children: [
        { label: "Lista Utenti", href: "/azienda/utenti", permission: "people.view" },
        { label: "Lista Team", href: "/azienda/team", locked: true },
        { label: "Organigramma", href: "/azienda/organigramma", locked: true },
        { label: "Gestione Lettere", href: "/azienda/lettere", locked: true },
      ],
    },
    { id: "mbo", label: "MBO", icon: Target, children: [], locked: true },
    { label: "Competenze", href: "/competenze", icon: BookOpen, locked: true },
    { label: "Valutazioni", href: "/valutazioni", icon: Star, locked: true },
    { label: "OKR", href: "/okr", icon: Goal, locked: true },
    { label: "Impostazioni", href: "/impostazioni", icon: Settings },
  ],
  dashboardTabs: [],
  settingsTabs: [{ label: "Permessi", href: "/impostazioni/permessi", permission: "access.manage" }],
  storagePrefix: "spark.free",
});

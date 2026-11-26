import { Info, Scale, Settings, User } from "lucide-react";
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
  // per-tenant: the company name comes from the settings document "org" written when the tenant is created
  org: { name: "Spark", emailDomains: [], companies: [], teams: [] },
  modules: [transparencyModule],
  nav: [
    { label: "Trasparenza retributiva", href: "/trasparenza", icon: Scale, permission: "transparency.view" },
    { label: "Profilo", href: "/profilo", icon: Info },
    {
      id: "azienda",
      label: "La mia azienda",
      icon: User,
      children: [{ label: "Lista Utenti", href: "/azienda/utenti", permission: "people.view" }],
    },
    { label: "Impostazioni", href: "/impostazioni", icon: Settings },
  ],
  dashboardTabs: [],
  settingsTabs: [{ label: "Permessi", href: "/impostazioni/permessi", permission: "access.manage" }],
  storagePrefix: "spark.free",
});

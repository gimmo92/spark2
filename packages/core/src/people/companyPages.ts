import { User } from "lucide-react";
import type { NavItem, NavLeaf } from "../config";

/**
 * "La mia azienda": the company pages every installation gets from the core. Each app has one route
 * `src/app/(app)/azienda/[...slug]/page.tsx` (renders `CompanyArea`) plus `azienda/utenti` and
 * `azienda/utenti/[id]`, and its menu uses `companyNav()`: a page added here reaches every app.
 */
export const COMPANY_PAGES: { slug: string; label: string; title: string; permission?: string; badge?: string }[] = [
  { slug: "societa", label: "Lista Società", title: "Lista Società", permission: "people.view" },
  { slug: "team", label: "Lista Team", title: "Lista Team", permission: "people.view" },
  { slug: "bu", label: "Business Unit", title: "Business Unit", permission: "people.view" },
  { slug: "ruoli", label: "Lista Ruoli", title: "Lista Ruoli", permission: "people.view" },
  { slug: "modifica", label: "Modifica azienda", title: "Modifica azienda", permission: "companies.manage" },
  { slug: "lettere", label: "Gestione Lettere", title: "Gestione Lettere", permission: "letters.manage", badge: "Beta" },
];

/** The "La mia azienda" menu group; `extra` adds the app's own entries (or locked ones) at the end. */
export function companyNav(extra: NavLeaf[] = []): NavItem {
  return {
    id: "azienda",
    label: "La mia azienda",
    icon: User,
    children: [
      { label: "Lista Utenti", href: "/azienda/utenti", permission: "people.view" },
      ...COMPANY_PAGES.map((p) => ({ label: p.label, href: `/azienda/${p.slug}`, permission: p.permission, badge: p.badge })),
      ...extra,
    ],
  };
}

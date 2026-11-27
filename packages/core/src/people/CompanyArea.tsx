"use client";

import { LettersPage } from "../letters/LettersPage";
import { tr } from "../i18n/i18n";
import { BusinessUnitsGrid } from "./BusinessUnitsGrid";
import { CompaniesList } from "./CompaniesList";
import { CompanyProfile } from "./CompanyProfile";
import { RolesList } from "./RolesList";
import { TeamsGrid } from "./TeamsGrid";

const PAGES: Record<string, () => React.ReactNode> = {
  societa: () => <CompaniesList />,
  team: () => <TeamsGrid />,
  bu: () => <BusinessUnitsGrid />,
  ruoli: () => <RolesList />,
  modifica: () => <CompanyProfile />,
  lettere: () => <LettersPage />,
};

/** Renders a "La mia azienda" page of the core by its slug (see `COMPANY_PAGES`). */
export function CompanyArea({ slug }: { slug: string }) {
  const page = PAGES[slug];
  return page ? <>{page()}</> : <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Pagina non trovata.")}</div>;
}

"use client";

import { useState } from "react";
import { useAccess } from "../access/useAccess";
import { useCore, useOrg } from "../shell/SparkProvider";
import { Field, PrimaryButton, inputCls } from "../ui/ui";
import { tr } from "../i18n/i18n";

/** La mia azienda → Modifica azienda: company data used across the modules (today: the sector). */
export function CompanyProfile() {
  const { sector, setSector } = useOrg();
  const { notify } = useCore();
  const { allowed } = useAccess();
  const canManage = allowed("companies.manage");
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? sector;
  const changed = draft != null && draft.trim() !== sector;

  return (
    <div className="space-y-3.5">
      <h1 className="text-[14px] font-semibold">{tr("Modifica azienda")}</h1>
      <form
        className="card max-w-xl space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!changed) return;
          setSector(value.trim());
          setDraft(null);
          notify(tr("Dati dell'azienda salvati"));
        }}
      >
        <Field label="Settore">
          <input disabled={!canManage} className={inputCls} value={value} onChange={(e) => setDraft(e.target.value)} placeholder={tr("es. Assicurazioni")} />
        </Field>
        {canManage && (
          <div className="flex justify-end">
            <PrimaryButton type="submit" disabled={!changed}>
              {tr("Salva")}
            </PrimaryButton>
          </div>
        )}
      </form>
    </div>
  );
}

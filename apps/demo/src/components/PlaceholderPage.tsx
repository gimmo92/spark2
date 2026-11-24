"use client";

import Link from "next/link";
import { Construction } from "lucide-react";
import { tr } from "@spark/core";

/** Demo menu entries without a screen yet. */
export function PlaceholderPage({ title, module }: { title: string; module?: boolean }) {
  return (
    <div className="space-y-4">
      <h1 className="text-[17px] font-bold">{tr(title)}</h1>
      <div className="card grid place-items-center px-6 py-20 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Construction className="h-6 w-6" />
        </div>
        <p className="mt-4 text-[14px] font-semibold">{module ? tr("Modulo non attivo per la tua azienda") : tr("Sezione in costruzione")}</p>
        <p className="mt-1 max-w-sm text-[12.5px] text-muted">
          {module ? tr("Contatta il tuo referente Spark per attivare questo modulo.") : tr("Questa pagina sarà disponibile a breve.")}
        </p>
        <Link href="/azienda/utenti" className="mt-4 text-[12.5px] font-semibold text-brand hover:underline">
          {tr("Vai alla Lista Utenti")}
        </Link>
      </div>
    </div>
  );
}

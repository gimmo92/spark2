"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Upload } from "lucide-react";
import { localeTag, tr, useAccess, useData } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { usePayAnalyses } from "../store";
import { Results, type ResultsView } from "./Results";

const VIEWS: ResultsView[] = ["dashboard", "ccnl", "qualifica", "ruolo", "cdr", "parivalore", "dipendenti"];

/**
 * Trasparenza salariale: gender pay gaps (EU directive 2023/970) of the data loaded in Compensation →
 * Caricamento dati. The analysis and the view live in the URL (?analisi=…&vista=…; default the
 * latest data), so coming back from an employee's page reopens them. The route needs <Suspense>.
 */
export function TransparencyPage({ uploadHref = "/caricamento-dati" }: { uploadHref?: string }) {
  const { analyses } = usePayAnalyses();
  const { allowed } = useAccess();
  const { hydrated } = useData();
  const canManage = allowed("transparency.manage");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlView = params.get("vista") as ResultsView | null;
  const view = urlView && VIEWS.includes(urlView) ? urlView : undefined;
  const doc = analyses.find((a) => a.id === params.get("analisi")) ?? analyses[0];
  const analysis = useMemo(() => (doc ? CompensationAnalysis.fromSnapshot(doc.snapshot) : null), [doc]);
  const remember = (id: string, v?: ResultsView) => router.replace(`${pathname}?analisi=${encodeURIComponent(id)}${v ? `&vista=${v}` : ""}`, { scroll: false });

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[14px] font-semibold">{tr("Trasparenza salariale")}</h1>
        </div>
        {analyses.length > 1 && doc && (
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            {tr("Dati")}
            <select
              value={doc.id}
              onChange={(e) => remember(e.target.value, view)}
              className="rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] font-semibold text-ink outline-none focus:border-brand"
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {new Date(a.createdAt).toLocaleDateString(localeTag())}
                </option>
              ))}
            </select>
          </label>
        )}
        {canManage && (
          <Link href={uploadHref} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-brand hover:bg-brand-soft">
            <Upload className="h-3.5 w-3.5" /> {tr("Carica dati")}
          </Link>
        )}
      </div>

      {!hydrated ? (
        <div className="card h-40 animate-pulse" />
      ) : !doc ? (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">
          {tr("Nessun dato caricato.")}{" "}
          {canManage && (
            <Link href={uploadHref} className="font-semibold text-brand hover:underline">
              {tr("Carica il tracciato retributivo")}
            </Link>
          )}
        </div>
      ) : !analysis ? (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Questi dati sono in un formato precedente: caricali di nuovo.")}</div>
      ) : (
        <Results
          key={doc.id}
          analysis={analysis}
          name={doc.name}
          analysisId={doc.id}
          initialView={view}
          onView={(v) => remember(doc.id, v)}
        />
      )}
    </div>
  );
}

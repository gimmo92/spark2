"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { localeTag, tr, useAccess } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { usePayAnalyses } from "../store";
import { RoleWeightsView } from "./RoleWeights";

/**
 * Job grading: weighting of the company's roles (art. 4 of the directive), on the roles of a saved
 * pay analysis. The weights are saved per role title and used by the equal-value bands.
 */
export function JobGradingPage({ transparencyHref = "/trasparenza" }: { transparencyHref?: string }) {
  const { analyses } = usePayAnalyses();
  const { allowed } = useAccess();
  const [id, setId] = useState("");
  const doc = analyses.find((a) => a.id === id) ?? analyses[0];
  const people = useMemo(() => (doc ? (CompensationAnalysis.fromSnapshot(doc.snapshot)?.employees ?? []) : []), [doc]);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[14px] font-semibold">{tr("Job grading")}</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">{tr("Pesatura dei ruoli per individuare il lavoro di pari valore (art. 4 della direttiva UE 2023/970).")}</p>
        </div>
        {analyses.length > 1 && (
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            {tr("Ruoli dall'analisi")}
            <select
              value={doc?.id ?? ""}
              onChange={(e) => setId(e.target.value)}
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
      </div>
      {doc ? (
        <RoleWeightsView people={people} canManage={allowed("transparency.manage")} />
      ) : (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">
          {tr("Per pesare i ruoli serve un'analisi salvata.")}{" "}
          <Link href={transparencyHref} className="font-semibold text-brand hover:underline">
            {tr("Carica il tracciato in Trasparenza salariale")}
          </Link>
        </div>
      )}
    </div>
  );
}

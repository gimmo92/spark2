"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { tr } from "@spark/core";
import { defaultRgaSelection, personPay, type RgaSelection } from "../lib/analysis/RgaComponents";
import { SalaryMath } from "../lib/analysis/SalaryMath";
import type { Employee } from "../lib/models/Employee";
import { SALARY_METRICS } from "../lib/models/constants";
import { eur, gap } from "./format";

/** How a person is opened from a group: their page (saved analysis) or the panel (not saved yet). */
export interface PersonOpener {
  href?: (e: Employee) => string;
  onOpen?: (e: Employee) => void;
}

const METRICS = [
  { id: SALARY_METRICS.base, label: "Base" },
  { id: SALARY_METRICS.variabile, label: "Variabile" },
  { id: SALARY_METRICS.totale, label: "Totale" },
] as const;

/** Name of a person that opens their page or panel. */
export function PersonName({ person, opener }: { person: Employee; opener: PersonOpener }) {
  const name = person.name || person.employeeId || tr("Dipendente");
  if (opener.href) {
    return (
      <Link href={opener.href(person)} className="font-semibold text-brand hover:underline">
        {name}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => opener.onOpen?.(person)} className="text-left font-semibold text-brand hover:underline">
      {name}
    </button>
  );
}

/** Chevron toggle of an expandable group row. */
export function ExpandToggle({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? tr("Chiudi {0}", [label]) : tr("Mostra i dipendenti di {0}", [label])}
      onClick={onClick}
      className="mr-1 inline-grid h-5 w-5 place-items-center rounded text-muted transition-colors hover:bg-canvas hover:text-ink"
    >
      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
    </button>
  );
}

/**
 * The people of a group (CCNL level, qualification, cost centre, role, job-grading band): base,
 * variable and total pay (FTE) and each one's deviation from the group mean.
 */
export function GroupPeople({ people, opener, rga }: { people: Employee[]; opener: PersonOpener; rga?: RgaSelection | null }) {
  // the voices chosen in the analysis (total and variable), defaults otherwise
  const voices = rga ?? defaultRgaSelection();
  const value = (e: Employee, m: (typeof METRICS)[number]["id"]) => {
    const v = personPay(e, m, m === SALARY_METRICS.base ? null : voices);
    return v != null && v > 0 ? v : null;
  };
  const means = METRICS.map((m) => {
    const vals = people.map((e) => value(e, m.id)).filter((v): v is number => v != null);
    return vals.length ? SalaryMath.mean(vals) : null;
  });
  const rows = [...people].sort((a, b) => (value(b, SALARY_METRICS.base) ?? 0) - (value(a, SALARY_METRICS.base) ?? 0));

  return (
    <div className="overflow-x-auto bg-[#fafbfd] px-4 py-2">
      <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
        <thead>
          <tr className="text-[10.5px] font-bold uppercase text-[#9aa2b1]">
            <th className="py-1.5 pl-6 pr-3">{tr("Dipendente")}</th>
            <th className="px-3 py-1.5">{tr("Sesso")}</th>
            {METRICS.map((m, i) => (
              <th key={m.id} className="px-3 py-1.5 text-right">
                {tr(m.label)}
                <span className="block font-semibold normal-case text-muted">{tr("media {0}", [eur(means[i])])}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.index} className="border-t border-line">
              <td className="py-1.5 pl-6 pr-3">
                <PersonName person={e} opener={opener} />
              </td>
              <td className="px-3 py-1.5 text-muted">{e.gender === "F" ? tr("Donna") : e.gender === "M" ? tr("Uomo") : "—"}</td>
              {METRICS.map((m, i) => {
                const v = value(e, m.id);
                const mean = means[i];
                const dev = v != null && mean ? ((v - mean) / mean) * 100 : null;
                return (
                  <td key={m.id} className="px-3 py-1.5 text-right tabular-nums">
                    {eur(v)}
                    <span className={`ml-1.5 inline-block w-[52px] text-[11px] ${dev == null ? "text-faint" : dev <= -10 ? "font-semibold text-red-600" : dev >= 10 ? "font-semibold text-emerald-700" : "text-muted"}`}>
                      {dev == null ? "" : gap(dev)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

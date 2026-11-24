"use client";

import { useMemo } from "react";
import { useAccess } from "../access/useAccess";
import { useCore, useOrg } from "../shell/SparkProvider";
import { Badge } from "../ui/ui";
import { tr } from "../i18n/i18n";

const collator = new Intl.Collator("it", { sensitivity: "base" });

/** La mia azienda → Lista Società: the group's companies with their business units, teams and active people. */
export function CompaniesList() {
  const { companies, teams, businessUnits = [] } = useOrg();
  const { users } = useCore();
  const { allowed } = useAccess();

  const rows = useMemo(() => {
    const active = users.filter((u) => u.status === "attivo" && allowed("people.view", u));
    // companies of the config, plus any company found on a user record
    const names = [...new Set([...companies, ...active.map((u) => u.company).filter(Boolean)])];
    return names
      .map((name) => {
        const companyTeams = teams.filter((t) => t.company === name);
        const bus = [
          ...new Set([
            ...businessUnits.filter((b) => b.company === name).map((b) => b.name),
            ...companyTeams.map((t) => t.bu).filter((b): b is string => !!b),
          ]),
        ].sort(collator.compare);
        return { name, bus, teams: companyTeams.length, people: active.filter((u) => u.company === name).length };
      })
      .sort((a, b) => b.people - a.people || collator.compare(a.name, b.name));
  }, [companies, teams, businessUnits, users, allowed]);
  const people = rows.reduce((n, r) => n + r.people, 0);

  return (
    <div className="space-y-3.5">
      <div>
        <h1 className="text-[14px] font-semibold">{tr("Società")}</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">{tr("{0} società · {1} utenti attivi", [rows.length, people])}</p>
      </div>

      {rows.length === 0 ? (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Nessuna società configurata.")}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                <th className="px-3 py-2.5 pl-4">{tr("Società")}</th>
                <th className="px-3 py-2.5">{tr("Business Unit")}</th>
                <th className="px-3 py-2.5 text-right">{tr("Team")}</th>
                <th className="px-3 py-2.5 pr-4 text-right">{tr("Utenti attivi")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-line align-top last:border-0 hover:bg-[#f8fafd]">
                  <td className="px-3 py-[9px] pl-4 text-[13.5px] font-semibold">{r.name}</td>
                  <td className="px-3 py-[9px]">
                    <div className="flex flex-wrap gap-1">
                      {r.bus.length ? r.bus.map((b) => <Badge key={b}>{b}</Badge>) : <span className="text-[12.5px] text-muted">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-[9px] text-right text-[12.5px] tabular-nums">{r.teams}</td>
                  <td className="px-3 py-[9px] pr-4 text-right text-[12.5px] font-semibold tabular-nums">{r.people}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

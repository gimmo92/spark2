"use client";

import Link from "next/link";
import { useCore, useOrg } from "../shell/SparkProvider";
import { Badge } from "../ui/ui";

/** La mia azienda → Business Unit: each BU with its company, teams and active people. */
export function BusinessUnitsGrid() {
  const { businessUnits = [], teams, buForTeam } = useOrg();
  const { users } = useCore();
  const active = users.filter((u) => u.status === "attivo");
  const unassigned = teams.filter((t) => !t.bu || !businessUnits.some((b) => b.name === t.bu));

  return (
    <div className="space-y-4">
      <div className="card px-5 py-4">
        <h1 className="text-[14px] font-semibold">Business Unit</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {businessUnits.length} business unit · {teams.length} team
          {unassigned.length > 0 && ` · ${unassigned.length} team senza BU`}
        </p>
      </div>
      {businessUnits.length === 0 && (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">Nessuna business unit configurata per questa azienda.</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {businessUnits.map((bu) => {
          const buTeams = teams.filter((t) => t.bu === bu.name);
          const members = active.filter((u) => u.team && buForTeam(u.team) === bu.name);
          const companies = bu.company ? [bu.company] : [...new Set(buTeams.map((t) => t.company))];
          return (
            <div key={bu.name} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[13.5px] font-semibold">{bu.name}</h2>
                <span className="text-right text-[12px] text-muted">{companies.join(", ") || "—"}</span>
              </div>
              <p className="mt-4 text-[26px] font-extrabold leading-none tabular-nums">{members.length}</p>
              <p className="mt-1 text-[12.5px] text-muted">membri attivi · {buTeams.length} team</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {buTeams.length ? buTeams.map((t) => <Badge key={t.name}>{t.name}</Badge>) : <Badge tone="grey">Nessun team</Badge>}
              </div>
              {members.length > 0 && (
                <div className="mt-4 flex -space-x-2">
                  {members.slice(0, 7).map((m) => (
                    <Link
                      key={m.id}
                      href={`/azienda/utenti/${m.id}`}
                      aria-label={`${m.firstName} ${m.lastName}`}
                      className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-brand-soft text-[11px] font-bold text-brand transition-transform hover:z-10 hover:-translate-y-0.5"
                    >
                      {(m.firstName[0] + (m.lastName[0] ?? "")).toUpperCase()}
                    </Link>
                  ))}
                  {members.length > 7 && (
                    <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-canvas text-[11px] font-bold text-muted">
                      +{members.length - 7}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

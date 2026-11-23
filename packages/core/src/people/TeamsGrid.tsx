"use client";

import { useOrg } from "../shell/SparkProvider";
import Link from "next/link";

import { useCore } from "../shell/SparkProvider";
import { Badge } from "../ui/ui";

export function TeamsGrid() {
  const { teamNames: TEAMS, companyForTeam } = useOrg();
  const { users } = useCore();
  const active = users.filter((u) => u.status === "attivo");

  return (
    <div className="space-y-4">
      <div className="card px-5 py-4">
        <h1 className="text-[14px] font-semibold">Team Registrati Alla Piattaforma</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">{TEAMS.length} team · {active.length} utenti attivi</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TEAMS.map((t) => {
          const members = active.filter((u) => u.team === t);
          const managers = members.filter((u) => u.level !== "UTENTE");
          return (
            <div key={t} className="card flex flex-col p-5 transition-shadow hover:shadow-[0_10px_30px_-10px_rgb(16_24_40/0.18)]">
              <div className="flex items-start justify-between gap-3">
                <Badge>{t}</Badge>
                <span className="text-[12px] text-muted">{companyForTeam(t)}</span>
              </div>
              <p className="mt-4 text-[26px] font-extrabold leading-none tabular-nums">{members.length}</p>
              <p className="mt-1 text-[12.5px] text-muted">membri attivi · {managers.length} manager</p>
              <div className="mt-4 flex -space-x-2">
                {members.slice(0, 7).map((m) => (
                  <Link
                    key={m.id}
                    href={`/azienda/utenti/${m.id}`}
                    title={`${m.firstName} ${m.lastName}`}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

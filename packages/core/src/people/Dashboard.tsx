"use client";

import { useOrg } from "../shell/SparkProvider";
import Link from "next/link";
import { ACCESS_LEVELS } from "./data"
import { useCore } from "../shell/SparkProvider";
import { DashboardTabs } from "../shell/PageTabs";

export function Dashboard() {
  const { teamNames: TEAMS } = useOrg();
  const { users } = useCore();
  const active = users.filter((u) => u.status === "attivo");
  const byTeam = TEAMS.map((t) => ({ t, n: active.filter((u) => u.team === t).length })).sort((a, b) => b.n - a.n);
  const max = Math.max(...byTeam.map((x) => x.n), 1);
  const recent = [...users].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  const stats = [
    { label: "Utenti attivi", value: active.length },
    { label: "Disattivati", value: users.length - active.length },
    { label: "Manager", value: active.filter((u) => u.level === "MANAGER").length },
    { label: "Team", value: TEAMS.length },
  ];

  return (
    <div className="space-y-4">
      <DashboardTabs />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-[12px] font-bold uppercase tracking-wide text-muted">{s.label}</p>
            <p className="mt-2 text-[24px] font-extrabold leading-none tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-5 text-[12px] font-bold uppercase tracking-wide text-muted">Utenti attivi per team</h2>
          <ul className="space-y-3.5">
            {byTeam.map(({ t, n }) => (
              <li key={t} className="grid grid-cols-[minmax(0,200px)_1fr_40px] items-center gap-4">
                <span className="truncate text-[12.5px] font-semibold">{t}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#eef1f5]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#22c3f5] to-[#2a7ef5]" style={{ width: `${(n / max) * 100}%` }} />
                </div>
                <span className="text-right text-[12.5px] font-semibold tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex gap-5 border-t border-line pt-4 text-[12px] text-muted">
            {ACCESS_LEVELS.map((l) => (
              <span key={l}>
                {l.charAt(0) + l.slice(1).toLowerCase()}:{" "}
                <span className="font-bold text-ink">{active.filter((u) => u.level === l).length}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 text-[12px] font-bold uppercase tracking-wide text-muted">Ultimi registrati</h2>
          <ul className="space-y-1">
            {recent.map((u) => (
              <li key={u.id}>
                <Link href={`/azienda/utenti/${u.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-canvas">
                  <span className="truncate text-[12.5px] font-semibold text-brand">
                    {u.firstName} {u.lastName}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">
                    {new Date(u.createdAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

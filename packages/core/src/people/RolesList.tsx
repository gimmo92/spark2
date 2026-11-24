"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { useAccess } from "../access/useAccess";
import { useCore } from "../shell/SparkProvider";
import { Badge } from "../ui/ui";
import { fullName, type User } from "./data";

const collator = new Intl.Collator("it", { sensitivity: "base" });

/** La mia azienda → Lista Ruoli: every role (User.role) with the active people who have it. */
export function RolesList() {
  const { users } = useCore();
  const { allowed } = useAccess();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const roles = useMemo(() => {
    const m = new Map<string, User[]>();
    for (const u of users) {
      if (u.status !== "attivo" || !allowed("people.view", u)) continue;
      const role = u.role.trim() || "Senza ruolo";
      m.set(role, [...(m.get(role) ?? []), u]);
    }
    const needle = q.trim().toLowerCase();
    return [...m.entries()]
      .filter(([role, people]) => !needle || role.toLowerCase().includes(needle) || people.some((p) => fullName(p).toLowerCase().includes(needle)))
      .sort((a, b) => b[1].length - a[1].length || collator.compare(a[0], b[0]));
  }, [users, allowed, q]);
  const people = roles.reduce((n, [, p]) => n + p.length, 0);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[14px] font-semibold">Ruoli</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {roles.length} ruoli · {people} utenti attivi
          </p>
        </div>
        <div className="relative ml-auto w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca ruolo o persona..."
            aria-label="Cerca ruolo o persona"
            className="w-full rounded-lg border border-[#e3e7ee] bg-white py-2 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15"
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
              <th className="px-3 py-2.5 pl-4">Ruolo</th>
              <th className="px-3 py-2.5">Persone</th>
              <th className="px-3 py-2.5">Team</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(([role, list]) => {
              const isOpen = open === role;
              const teams = [...new Set(list.map((u) => u.team).filter(Boolean))].sort(collator.compare);
              return (
                <tr key={role} className="border-b border-line align-top last:border-0 hover:bg-[#f8fafd]">
                  <td className="px-3 py-[9px] pl-4">
                    <button type="button" onClick={() => setOpen(isOpen ? null : role)} className="flex items-start gap-1.5 text-left" aria-expanded={isOpen}>
                      <ChevronDown className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      <span className={`text-[13.5px] font-semibold ${role === "Senza ruolo" ? "text-muted" : ""}`}>{role}</span>
                    </button>
                    {isOpen && (
                      <ul className="mt-2 space-y-1 pl-5">
                        {[...list]
                          .sort((a, b) => collator.compare(a.lastName, b.lastName))
                          .map((u) => (
                            <li key={u.id} className="text-[12.5px]">
                              <Link href={`/azienda/utenti/${u.id}`} className="font-semibold text-brand hover:underline">
                                {fullName(u)}
                              </Link>
                              <span className="text-muted"> · {u.team || "Nessun team"}</span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-[9px] text-[13px] tabular-nums text-[#5b6476]">{list.length}</td>
                  <td className="px-3 py-[7px]">
                    <div className="flex max-w-[420px] flex-wrap gap-1">
                      {teams.length ? teams.map((t) => <Badge key={t}>{t}</Badge>) : <Badge tone="grey">Nessun team</Badge>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {roles.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center">
                  <p className="text-[14px] font-semibold">Nessun ruolo trovato</p>
                  <p className="mt-1 text-[12.5px] text-muted">I ruoli vengono dal campo Ruolo degli utenti.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useAccess } from "../access/useAccess";
import { useCore, useOrg } from "../shell/SparkProvider";
import { fullName } from "./data";

/** Profilo: the logged-in user (from the server's viewer + their record in Lista Utenti). */
export function MyProfile() {
  const { viewer, hydrated, users } = useCore();
  const { me, levelName, isAdmin } = useAccess();
  const org = useOrg();
  if (!hydrated) return <div className="card h-24 animate-pulse" />;

  const name = me ? fullName(me) : isAdmin ? "Amministratore" : (viewer?.email ?? "Utente");
  const initials = me ? (me.firstName[0] + (me.lastName[0] ?? "")).toUpperCase() : org.name.slice(0, 2).toUpperCase();
  const level = levelName(viewer?.level ?? me?.level ?? "ADMIN");
  const manager = me?.managerId ? users.find((u) => u.id === me.managerId) : undefined;
  const reports = me ? users.filter((u) => u.managerId === me.id && u.status === "attivo") : [];

  return (
    <div className="space-y-4">
      <h1 className="text-[17px] font-bold">Profilo</h1>
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#22c3f5] to-[#2a7ef5] text-[17px] font-extrabold text-white">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-[16px] font-bold">{name}</p>
          <p className="text-[13px] text-muted">
            {[me?.role, me?.team || undefined, org.name].filter(Boolean).join(" · ")} · Livello {level}
          </p>
          {viewer?.email && <p className="text-[12.5px] text-muted">{viewer.email}</p>}
        </div>
      </div>
      {me && (manager || reports.length > 0) && (
        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Responsabile</p>
            <p className="mt-1 text-[13px]">{manager ? fullName(manager) : "—"}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Riporti diretti</p>
            <ul className="mt-1 space-y-0.5 text-[13px]">
              {reports.length
                ? reports.slice(0, 12).map((r) => (
                    <li key={r.id}>
                      <Link href={`/azienda/utenti/${r.id}`} className="text-brand hover:underline">
                        {fullName(r)}
                      </Link>
                    </li>
                  ))
                : "—"}
              {reports.length > 12 && <li className="text-muted">e altri {reports.length - 12}</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

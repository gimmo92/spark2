"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Calendar, Mail, Shield, Users } from "lucide-react";
import { fullName } from "@/lib/data";
import { useStore } from "@/lib/store";
import { Badge, PrimaryButton } from "./ui";
import { UserFormModal } from "./UserForm";
import { RegistrationCard } from "./InviteAction";

export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const { users, updateUser, notify } = useStore();
  const [editing, setEditing] = useState(false);
  const u = users.find((x) => x.id === id);

  if (!u)
    return (
      <div className="card p-10 text-center">
        <p className="text-[14px] font-semibold">Utente non trovato</p>
        <Link href="/azienda/utenti" className="mt-3 inline-block font-semibold text-brand hover:underline">
          Torna alla lista utenti
        </Link>
      </div>
    );

  const teammates = users.filter((x) => x.team && x.team === u.team && x.id !== u.id && x.status === "attivo").slice(0, 8);
  const initials = (u.firstName[0] + (u.lastName[0] ?? "")).toUpperCase();

  return (
    <div className="space-y-4">
      <Link href="/azienda/utenti" className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Lista Utenti
      </Link>

      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#22c3f5] to-[#2a7ef5] text-[17px] font-extrabold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-bold leading-tight">{fullName(u)}</h1>
          <p className="mt-0.5 text-[13px] text-muted">{u.role}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={u.level === "ADMIN" ? "navy" : "blue"}>{u.level}</Badge>
            {u.team ? <Badge>{u.team}</Badge> : <Badge tone="grey">Nessun team</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const next = u.status === "attivo" ? "disattivato" : "attivo";
              updateUser(u.id, { status: next });
              notify(next === "attivo" ? "Account riattivato" : "Account disattivato");
            }}
            className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            {u.status === "attivo" ? "Disattiva" : "Riattiva"}
          </button>
          <PrimaryButton onClick={() => setEditing(true)}>Modifica</PrimaryButton>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-[12px] font-bold uppercase tracking-wide text-muted">Anagrafica</h2>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Info icon={<Mail className="h-4 w-4" />} label="Email">
              <a href={`mailto:${u.email}`} className="text-brand hover:underline">
                {u.email}
              </a>
            </Info>
            <Info icon={<Shield className="h-4 w-4" />} label="Livello di accesso">
              {u.level.charAt(0) + u.level.slice(1).toLowerCase()}
            </Info>
            <Info icon={<Building2 className="h-4 w-4" />} label="Società">
              {u.company}
            </Info>
            <Info icon={<Users className="h-4 w-4" />} label="Team">
              {u.team || "—"}
            </Info>
            <Info icon={<Calendar className="h-4 w-4" />} label="Registrato il">
              {new Date(u.createdAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
            </Info>
            <Info icon={<span className={`h-2 w-2 rounded-full ${u.status === "attivo" ? "bg-emerald-500" : "bg-faint"}`} />} label="Stato">
              {u.status === "attivo" ? "Attivo" : "Disattivato"}
            </Info>
          </dl>
        </div>

        <div className="space-y-4">
          <RegistrationCard user={u} />
          <div className="card p-5">
            <h2 className="mb-4 text-[12px] font-bold uppercase tracking-wide text-muted">Colleghi nel team</h2>
            {teammates.length === 0 && <p className="text-[12.5px] text-muted">Nessun collega nel team.</p>}
            <ul className="space-y-1">
              {teammates.map((t) => (
                <li key={t.id}>
                  <Link href={`/azienda/utenti/${t.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-canvas">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">
                      {(t.firstName[0] + (t.lastName[0] ?? "")).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold">{fullName(t)}</span>
                      <span className="block truncate text-[11px] text-muted">{t.role}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {editing && <UserFormModal user={u} onClose={() => setEditing(false)} />}
    </div>
  );
}

function Info({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-[11px] font-semibold text-faint">
        <span className="grid w-4 place-items-center">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 pl-6 text-[13px] font-semibold">{children}</dd>
    </div>
  );
}

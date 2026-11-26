"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAccess } from "../access/useAccess";
import { useCore, useOrg } from "../shell/SparkProvider";
import { Badge, Field, GhostButton, Modal, PrimaryButton, Tooltip, inputCls } from "../ui/ui";
import { tr } from "../i18n/i18n";

const collator = new Intl.Collator("it", { sensitivity: "base" });

type Team = { name: string; company: string; bu?: string };

/**
 * La mia azienda → Lista Team. With "teams.manage" teams can be added, edited (company, business unit;
 * renaming moves their users) and deleted when nobody is in them. Saved in the settings document "org";
 * until the first change the list is the client config's `org.teams`.
 */
export function TeamsGrid() {
  const { teams, companies, businessUnits = [], setTeams } = useOrg();
  const { users, updateUser, notify } = useCore();
  const { allowed } = useAccess();
  const canManage = allowed("teams.manage");
  const [editing, setEditing] = useState<Team | "new" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const active = users.filter((u) => u.status === "attivo");

  const save = (team: Team, old?: Team) => {
    if (!old) {
      setTeams([...teams, team]);
      notify(tr("Team aggiunto"));
      return;
    }
    setTeams(teams.map((t) => (t.name === old.name ? team : t)));
    const moved = old.name !== team.name ? users.filter((u) => u.team === old.name) : [];
    for (const u of moved) updateUser(u.id, { team: team.name });
    notify(moved.length ? tr("Team aggiornato · {0} utenti spostati", [moved.length]) : tr("Team aggiornato"));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[14px] font-semibold">{tr("Team")}</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">{tr("{0} team · {1} utenti attivi", [teams.length, active.length])}</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="btn-gradient ml-auto flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[-0.02em] text-white"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> {tr("Nuovo team")}
          </button>
        )}
      </div>
      {teams.length === 0 && <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Nessun team: creane uno per organizzare gli utenti.")}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {teams.map((t) => {
          const members = active.filter((u) => u.team === t.name);
          const managers = members.filter((u) => u.level !== "UTENTE");
          const used = users.filter((u) => u.team === t.name).length;
          return (
            <div key={t.name} className="card flex flex-col p-5 transition-shadow hover:shadow-[0_10px_30px_-10px_rgb(16_24_40/0.18)]">
              <div className="flex items-start justify-between gap-3">
                <Badge>{t.name}</Badge>
                <span className="text-right text-[12px] text-muted">
                  {t.company || "—"}
                  {t.bu && <span className="block">{tr("BU {0}", [t.bu])}</span>}
                </span>
              </div>
              <p className="mt-4 text-[26px] font-extrabold leading-none tabular-nums">{members.length}</p>
              <p className="mt-1 text-[12.5px] text-muted">{tr("membri attivi · {0} manager", [managers.length])}</p>
              <div className="mt-4 flex items-end justify-between gap-2">
                <div className="flex -space-x-2">
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
                    <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-canvas text-[11px] font-bold text-muted">+{members.length - 7}</span>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-0.5">
                    <Tooltip label={tr("Modifica")}>
                      <button
                        type="button"
                        aria-label={tr("Modifica {0}", [t.name])}
                        onClick={() => setEditing(t)}
                        className="grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors hover:bg-brand-soft hover:text-brand"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                    </Tooltip>
                    <Tooltip label={used ? tr("Non eliminabile: {0} utenti in questo team", [used]) : tr("Elimina")}>
                      <button
                        type="button"
                        aria-label={tr("Elimina {0}", [t.name])}
                        disabled={used > 0}
                        onClick={() => setDeleting(t.name)}
                        className="grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#6c7486]"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <TeamModal
          team={editing === "new" ? undefined : editing}
          companies={companies}
          businessUnits={businessUnits}
          taken={teams.map((t) => t.name).filter((n) => editing === "new" || n !== editing.name)}
          onSave={(team) => {
            save(team, editing === "new" ? undefined : editing);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <Modal
          title="Eliminare il team?"
          onClose={() => setDeleting(null)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setDeleting(null)}>{tr("Annulla")}</GhostButton>
              <PrimaryButton
                className="!bg-none !bg-red-600 !shadow-none"
                onClick={() => {
                  setTeams(teams.filter((t) => t.name !== deleting));
                  notify(tr("Team eliminato"));
                  setDeleting(null);
                }}
              >
                {tr("Elimina")}
              </PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">{deleting}</span> {tr("non sarà più selezionabile nei profili utente.")}
          </p>
        </Modal>
      )}
    </div>
  );
}

function TeamModal({
  team,
  companies,
  businessUnits,
  taken,
  onSave,
  onClose,
}: {
  team?: Team;
  companies: string[];
  businessUnits: { name: string; company?: string }[];
  taken: string[];
  onSave: (team: Team) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [company, setCompany] = useState(team?.company ?? companies[0] ?? "");
  const [bu, setBu] = useState(team?.bu ?? "");
  const [submitted, setSubmitted] = useState(false);
  const v = name.trim();
  const error = !v ? "Inserisci il nome del team" : taken.some((t) => collator.compare(t, v) === 0) ? "Esiste già un team con questo nome" : undefined;
  const bus = businessUnits.filter((b) => !b.company || !company || b.company === company);
  const submit = () => {
    setSubmitted(true);
    if (!error) onSave({ name: v, company, ...(bu && { bu }) });
  };
  return (
    <Modal
      title={team ? "Modifica team" : "Nuovo team"}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Annulla")}</GhostButton>
          <PrimaryButton onClick={submit}>{team ? tr("Salva") : tr("Aggiungi")}</PrimaryButton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <Field label="Nome team" error={submitted ? error : undefined}>
          <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("es. Amministrazione")} />
        </Field>
        <Field label="Società">
          <select className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)}>
            {!companies.includes(company) && <option value={company}>{company || "—"}</option>}
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Business Unit">
          <select className={inputCls} value={bu} onChange={(e) => setBu(e.target.value)}>
            <option value="">{tr("Nessuna")}</option>
            {bus.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        {team && v !== team.name && <p className="text-[12px] text-muted">{tr("Gli utenti del team vengono spostati sul nuovo nome.")}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

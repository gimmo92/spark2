"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAccess } from "../access/useAccess";
import { useCore, useOrg } from "../shell/SparkProvider";
import { Badge, Field, GhostButton, Modal, PrimaryButton, Tooltip, inputCls } from "../ui/ui";
import { tr } from "../i18n/i18n";

const collator = new Intl.Collator("it", { sensitivity: "base" });

type Bu = { name: string; company?: string };

/**
 * La mia azienda → Business Unit: each BU with its company, teams and active people. With
 * "teams.manage" BUs can be added, edited (renaming moves their teams) and deleted when no team uses them.
 * Saved in the settings document "org"; until the first change the list is the client config's.
 */
export function BusinessUnitsGrid() {
  const { businessUnits = [], teams, companies, buForTeam, setBusinessUnits, setTeams } = useOrg();
  const { users, notify } = useCore();
  const { allowed } = useAccess();
  const canManage = allowed("teams.manage");
  const [editing, setEditing] = useState<Bu | "new" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const active = users.filter((u) => u.status === "attivo");
  const unassigned = teams.filter((t) => !t.bu || !businessUnits.some((b) => b.name === t.bu));

  const save = (bu: Bu, old?: Bu) => {
    if (!old) {
      setBusinessUnits([...businessUnits, bu]);
      notify(tr("Business unit aggiunta"));
      return;
    }
    setBusinessUnits(businessUnits.map((b) => (b.name === old.name ? bu : b)));
    if (old.name !== bu.name) setTeams(teams.map((t) => (t.bu === old.name ? { ...t, bu: bu.name } : t)));
    notify(tr("Business unit aggiornata"));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[14px] font-semibold">{tr("Business Unit")}</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {tr("{0} business unit · {1} team", [businessUnits.length, teams.length])}
            {unassigned.length > 0 && tr(" · {0} team senza BU", [unassigned.length])}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="btn-gradient ml-auto flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[-0.02em] text-white"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> {tr("Nuova business unit")}
          </button>
        )}
      </div>
      {businessUnits.length === 0 && (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Nessuna business unit: raggruppano i team, anche di società diverse.")}</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {businessUnits.map((bu) => {
          const buTeams = teams.filter((t) => t.bu === bu.name);
          const members = active.filter((u) => u.team && buForTeam(u.team) === bu.name);
          const buCompanies = bu.company ? [bu.company] : [...new Set(buTeams.map((t) => t.company))];
          return (
            <div key={bu.name} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[13.5px] font-semibold">{bu.name}</h2>
                <span className="text-right text-[12px] text-muted">{buCompanies.join(", ") || "—"}</span>
              </div>
              <p className="mt-4 text-[26px] font-extrabold leading-none tabular-nums">{members.length}</p>
              <p className="mt-1 text-[12.5px] text-muted">{tr("membri attivi · {0} team", [buTeams.length])}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {buTeams.length ? buTeams.map((t) => <Badge key={t.name}>{t.name}</Badge>) : <Badge tone="grey">{tr("Nessun team")}</Badge>}
              </div>
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
                        aria-label={tr("Modifica {0}", [bu.name])}
                        onClick={() => setEditing(bu)}
                        className="grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors hover:bg-brand-soft hover:text-brand"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                    </Tooltip>
                    <Tooltip label={buTeams.length ? tr("Non eliminabile: {0} team in questa BU", [buTeams.length]) : tr("Elimina")}>
                      <button
                        type="button"
                        aria-label={tr("Elimina {0}", [bu.name])}
                        disabled={buTeams.length > 0}
                        onClick={() => setDeleting(bu.name)}
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
        <BuModal
          bu={editing === "new" ? undefined : editing}
          companies={companies}
          taken={businessUnits.map((b) => b.name).filter((n) => editing === "new" || n !== editing.name)}
          onSave={(bu) => {
            save(bu, editing === "new" ? undefined : editing);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <Modal
          title="Eliminare la business unit?"
          onClose={() => setDeleting(null)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setDeleting(null)}>{tr("Annulla")}</GhostButton>
              <PrimaryButton
                className="!bg-none !bg-red-600 !shadow-none"
                onClick={() => {
                  setBusinessUnits(businessUnits.filter((b) => b.name !== deleting));
                  notify(tr("Business unit eliminata"));
                  setDeleting(null);
                }}
              >
                {tr("Elimina")}
              </PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">{deleting}</span> {tr("non sarà più selezionabile nei team.")}
          </p>
        </Modal>
      )}
    </div>
  );
}

function BuModal({ bu, companies, taken, onSave, onClose }: { bu?: Bu; companies: string[]; taken: string[]; onSave: (bu: Bu) => void; onClose: () => void }) {
  const [name, setName] = useState(bu?.name ?? "");
  const [company, setCompany] = useState(bu?.company ?? "");
  const [submitted, setSubmitted] = useState(false);
  const v = name.trim();
  const error = !v ? "Inserisci il nome della business unit" : taken.some((t) => collator.compare(t, v) === 0) ? "Esiste già una business unit con questo nome" : undefined;
  const submit = () => {
    setSubmitted(true);
    if (!error) onSave({ name: v, ...(company && { company }) });
  };
  return (
    <Modal
      title={bu ? "Modifica business unit" : "Nuova business unit"}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Annulla")}</GhostButton>
          <PrimaryButton onClick={submit}>{bu ? tr("Salva") : tr("Aggiungi")}</PrimaryButton>
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
        <Field label="Nome business unit" error={submitted ? error : undefined}>
          <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("es. Commerciale")} />
        </Field>
        <Field label="Società">
          <select className={inputCls} value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">{tr("Più società")}</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        {bu && v !== bu.name && <p className="text-[12px] text-muted">{tr("I team di questa business unit vengono aggiornati con il nuovo nome.")}</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

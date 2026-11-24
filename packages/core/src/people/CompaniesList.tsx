"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAccess } from "../access/useAccess";
import { useCore, useOrg } from "../shell/SparkProvider";
import { Badge, Field, GhostButton, Modal, PrimaryButton, Tooltip, inputCls } from "../ui/ui";
import { tr } from "../i18n/i18n";

const collator = new Intl.Collator("it", { sensitivity: "base" });

/**
 * La mia azienda → Lista Società: the group's companies with their business units, teams and active people.
 * With "companies.manage" companies can be added, renamed (their users follow) and deleted (only when no user has them).
 * The list is saved in the settings document "org"; until the first change it is the client config's `org.companies`.
 */
export function CompaniesList() {
  const { companies, teams, businessUnits = [], setCompanies } = useOrg();
  const { users, updateUser, notify } = useCore();
  const { allowed } = useAccess();
  const canManage = allowed("companies.manage");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const rows = useMemo(() => {
    const active = users.filter((u) => u.status === "attivo" && allowed("people.view", u));
    // companies of the list, plus any company still found on a user record
    const names = [...new Set([...companies, ...users.map((u) => u.company).filter(Boolean)])];
    return names
      .map((name) => {
        const companyTeams = teams.filter((t) => t.company === name);
        const bus = [
          ...new Set([
            ...businessUnits.filter((b) => b.company === name).map((b) => b.name),
            ...companyTeams.map((t) => t.bu).filter((b): b is string => !!b),
          ]),
        ].sort(collator.compare);
        return {
          name,
          listed: companies.includes(name),
          bus,
          teams: companyTeams.length,
          people: active.filter((u) => u.company === name).length,
          // every user record (also inactive / not visible): a company in use can't be deleted
          used: users.filter((u) => u.company === name).length,
        };
      })
      .sort((a, b) => b.people - a.people || collator.compare(a.name, b.name));
  }, [companies, teams, businessUnits, users, allowed]);
  const people = rows.reduce((n, r) => n + r.people, 0);

  const save = (name: string, old?: string) => {
    if (!old) {
      setCompanies([...companies, name]);
      notify(tr("Società aggiunta"));
      return;
    }
    setCompanies(companies.includes(old) ? companies.map((c) => (c === old ? name : c)) : [...companies, name]);
    const moved = users.filter((u) => u.company === old);
    for (const u of moved) updateUser(u.id, { company: name });
    notify(moved.length ? tr("Società rinominata · {0} utenti aggiornati", [moved.length]) : tr("Società rinominata"));
  };

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[14px] font-semibold">{tr("Società")}</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">{tr("{0} società · {1} utenti attivi", [rows.length, people])}</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="btn-gradient ml-auto flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[-0.02em] text-white"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> {tr("Nuova società")}
          </button>
        )}
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
                <th className="px-3 py-2.5 text-right">{tr("Utenti attivi")}</th>
                {canManage && <th className="w-[80px] px-3 py-2.5 pr-4">{tr("Azioni")}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-b border-line align-top last:border-0 hover:bg-[#f8fafd]">
                  <td className="px-3 py-[9px] pl-4">
                    <span className="text-[13.5px] font-semibold">{r.name}</span>
                    {!r.listed && <span className="ml-2 text-[11.5px] text-amber-700">{tr("solo sui profili utente")}</span>}
                  </td>
                  <td className="px-3 py-[9px]">
                    <div className="flex flex-wrap gap-1">
                      {r.bus.length ? r.bus.map((b) => <Badge key={b}>{b}</Badge>) : <span className="text-[12.5px] text-muted">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-[9px] text-right text-[12.5px] tabular-nums">{r.teams}</td>
                  <td className="px-3 py-[9px] text-right text-[12.5px] font-semibold tabular-nums">{r.people}</td>
                  {canManage && (
                    <td className="px-3 py-[5px] pr-4">
                      <div className="flex items-center gap-0.5">
                        <Tooltip label={tr("Rinomina")}>
                          <button
                            type="button"
                            aria-label={tr("Rinomina {0}", [r.name])}
                            onClick={() => setEditing(r.name)}
                            className="grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors hover:bg-brand-soft hover:text-brand"
                          >
                            <Pencil className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                        </Tooltip>
                        <Tooltip label={r.used ? tr("Non eliminabile: {0} utenti in questa società", [r.used]) : tr("Elimina")}>
                          <button
                            type="button"
                            aria-label={tr("Elimina {0}", [r.name])}
                            disabled={r.used > 0 || !r.listed}
                            onClick={() => setDeleting(r.name)}
                            className="grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#6c7486]"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <CompanyModal
          name={editing === "new" ? undefined : editing}
          taken={rows.map((r) => r.name).filter((n) => n !== editing)}
          onSave={(name) => {
            save(name, editing === "new" ? undefined : editing);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <Modal
          title="Eliminare la società?"
          onClose={() => setDeleting(null)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setDeleting(null)}>{tr("Annulla")}</GhostButton>
              <PrimaryButton
                className="!bg-none !bg-red-600 !shadow-none"
                onClick={() => {
                  setCompanies(companies.filter((c) => c !== deleting));
                  notify(tr("Società eliminata"));
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

function CompanyModal({ name, taken, onSave, onClose }: { name?: string; taken: string[]; onSave: (name: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(name ?? "");
  const [submitted, setSubmitted] = useState(false);
  const v = value.trim();
  const error = !v ? "Inserisci il nome della società" : taken.some((t) => collator.compare(t, v) === 0) ? "Esiste già una società con questo nome" : undefined;
  const submit = () => {
    setSubmitted(true);
    if (!error) onSave(v);
  };
  return (
    <Modal
      title={name ? "Rinomina società" : "Nuova società"}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Annulla")}</GhostButton>
          <PrimaryButton onClick={submit}>{name ? tr("Salva") : tr("Aggiungi")}</PrimaryButton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-2"
      >
        <Field label="Nome società" error={submitted ? error : undefined}>
          <input autoFocus className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} placeholder={tr("es. Rossi Industrie S.p.A.")} />
        </Field>
        {name && <p className="text-[12px] text-muted">{tr("Gli utenti di questa società vengono aggiornati con il nuovo nome.")}</p>}
      </form>
    </Modal>
  );
}

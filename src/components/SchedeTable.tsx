"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  CircleDot,
} from "lucide-react";
import { TEAMS, fullName, type User } from "@/lib/data";
import { SCHEDA_STATUSES, YEARS, schedaScore, statusLabel, type Objective, type Scheda, type SchedaStatus } from "@/lib/mbo";
import { useStore } from "@/lib/store";
import { Badge, Field, FilterMenu, GhostButton, Modal, PrimaryButton, inputCls } from "./ui";

const STATUS_STYLE: Record<SchedaStatus, string> = {
  bozza: "bg-[#eef1f5] text-[#5b6476]",
  in_approvazione: "bg-amber-50 text-amber-700",
  approvata: "bg-brand-soft text-brand",
  consuntivata: "bg-emerald-50 text-emerald-700",
  archiviata: "bg-[#f1f2f4] text-faint",
};

export function StatusPill({ status }: { status: SchedaStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold ${STATUS_STYLE[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

type SortKey = "user" | "year" | "team" | "score" | "status" | "updatedAt";
const collator = new Intl.Collator("it", { sensitivity: "base" });

export function SchedeTable() {
  const { schede, users, updateScheda, notify } = useStore();
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const [status, setStatus] = useState("");
  const [year, setYear] = useState("2026");
  const [team, setTeam] = useState("");
  const [showArchived, setShowArchived] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "user", dir: 1 });
  const [viewing, setViewing] = useState<Scheda | null>(null);
  const [editing, setEditing] = useState<Scheda | "new" | null>(null);
  const [archiving, setArchiving] = useState<Scheda | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const val = (s: Scheda, k: SortKey): string | number => {
      const u = byId.get(s.userId);
      if (k === "user") return u ? `${u.lastName} ${u.firstName}` : "";
      if (k === "team") return u?.team ?? "";
      if (k === "score") return schedaScore(s);
      if (k === "status") return SCHEDA_STATUSES.findIndex((x) => x.value === s.status);
      return s[k];
    };
    return schede
      .filter((s) => {
        const u = byId.get(s.userId);
        if (status ? s.status !== status : s.status === "archiviata" && !showArchived) return false;
        if (year && s.year !== Number(year)) return false;
        if (team && u?.team !== team) return false;
        if (needle && !(`${u ? fullName(u) : ""} ${s.title}`.toLowerCase().includes(needle))) return false;
        return true;
      })
      .sort((a, b) => {
        const x = val(a, sort.key);
        const y = val(b, sort.key);
        const c = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
        return c * sort.dir;
      });
  }, [schede, byId, status, year, team, showArchived, q, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const anyFilter = status || year !== "2026" || team || showArchived || q;

  const cols: { key: SortKey | "objectives"; label: string }[] = [
    { key: "user", label: "Dipendente" },
    { key: "year", label: "Anno" },
    { key: "team", label: "Team" },
    { key: "objectives", label: "Obiettivi" },
    { key: "score", label: "Raggiungimento" },
    { key: "status", label: "Stato" },
    { key: "updatedAt", label: "Aggiornata" },
  ];

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="btn-gradient flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[-0.02em] text-white sm:px-5"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Nuova scheda
        </button>
      </div>

      <div className="card overflow-hidden px-4 pb-3 pt-2.5">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-[14px] font-semibold text-ink">Schede Obiettivo MBO</h1>
          <span className="text-[13px] font-semibold tabular-nums text-ink">{rows.length} schede</span>
        </div>
        <div className="mt-2 flex h-1 overflow-hidden rounded-full bg-[#eef1f5]">
          {SCHEDA_STATUSES.filter((s) => s.value !== "archiviata").map((s) => {
            const n = rows.filter((r) => r.status === s.value).length;
            const color = { bozza: "#c3c8d1", in_approvazione: "#f59e0b", approvata: "#1673e6", consuntivata: "#10b981", archiviata: "" }[s.value];
            return <div key={s.value} title={`${s.label}: ${n}`} style={{ width: `${rows.length ? (n / rows.length) * 100 : 0}%`, background: color }} />;
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <FilterMenu
          icon={<CalendarDays className="h-3.5 w-3.5 text-[#7d8698]" />}
          label="Filtra per anno"
          activeLabel="Anno"
          value={year}
          onChange={setYear}
          options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
        />
        <FilterMenu
          icon={<CircleDot className="h-3.5 w-3.5 text-[#7d8698]" />}
          label="Stato scheda"
          activeLabel="Stato"
          value={status}
          onChange={setStatus}
          options={SCHEDA_STATUSES}
        />
        <FilterMenu
          icon={<UserRound className="h-3.5 w-3.5 fill-[#7d8698] text-[#7d8698]" />}
          label="Filtra per team"
          activeLabel="Team"
          value={team}
          onChange={setTeam}
          options={TEAMS.map((t) => ({ value: t, label: t }))}
        />
        {!status && (
          <FilterMenu
            icon={<Archive className="h-3.5 w-3.5 text-[#7d8698]" />}
            label="Archiviate"
            value={showArchived}
            onChange={setShowArchived}
            options={[{ value: "si", label: "Mostra archiviate" }]}
          />
        )}
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setStatus("");
              setYear("2026");
              setTeam("");
              setShowArchived("");
              setQ("");
            }}
            className="px-2 py-1.5 text-[12.5px] font-semibold text-brand hover:underline"
          >
            Azzera
          </button>
        )}
        <div className="relative ml-auto w-full sm:w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca dipendente o scheda..."
            className="w-full rounded-lg border border-[#e3e7ee] bg-white py-1.5 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15"
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {cols.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th key={c.key} className="px-3 py-2.5 first:pl-4">
                    {c.key === "objectives" ? (
                      <span className="text-[11px] font-bold uppercase text-[#9aa2b1]">{c.label}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key as SortKey)}
                        className={`flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold uppercase transition-colors ${
                          active ? "text-[#5c6577]" : "text-[#9aa2b1] hover:text-[#5c6577]"
                        }`}
                      >
                        {c.label}
                        {active ? (
                          sort.dir === 1 ? (
                            <ChevronUp className="h-3 w-3 fill-current" strokeWidth={3} />
                          ) : (
                            <ChevronDown className="h-3 w-3 fill-current" strokeWidth={3} />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3" strokeWidth={2.5} />
                        )}
                      </button>
                    )}
                  </th>
                );
              })}
              <th className="sticky right-0 w-[112px] border-l border-line bg-white px-3 py-2.5 text-[11px] font-bold uppercase text-[#9aa2b1]">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const u = byId.get(s.userId);
              const score = schedaScore(s);
              return (
                <tr key={s.id} className={`group border-b border-line last:border-0 hover:bg-[#f8fafd] ${s.status === "archiviata" ? "opacity-60" : ""}`}>
                  <td className="px-3 py-[9px] pl-4">
                    <button type="button" onClick={() => setViewing(s)} className="block text-left">
                      <span className="block whitespace-nowrap text-[13.5px] font-semibold text-brand hover:underline">
                        {u ? fullName(u) : "Utente rimosso"}
                      </span>
                      <span className="block max-w-[260px] truncate text-[11.5px] text-muted" title={s.title}>
                        {s.title}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 text-[13px] tabular-nums text-[#5b6476]">{s.year}</td>
                  <td className="px-3">{u?.team ? <Badge>{u.team}</Badge> : <Badge tone="grey">Nessun team</Badge>}</td>
                  <td className="px-3 text-[13px] tabular-nums text-[#5b6476]">{s.objectives.length}</td>
                  <td className="px-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#eef1f5]">
                        <div
                          className={`h-full rounded-full ${score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-brand" : "bg-amber-500"}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span className="w-9 text-[12px] font-semibold tabular-nums text-[#5b6476]">{score}%</span>
                    </div>
                  </td>
                  <td className="px-3">
                    <StatusPill status={s.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 text-[12px] tabular-nums text-muted">
                    {new Date(s.updatedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="sticky right-0 border-l border-line bg-white px-3 py-1 group-hover:bg-[#f8fafd]">
                    <div className="flex items-center gap-0.5">
                      <IconBtn label="Visualizza" onClick={() => setViewing(s)}>
                        <Eye className="h-4 w-4" strokeWidth={2.2} />
                      </IconBtn>
                      <IconBtn label="Modifica" onClick={() => setEditing(s)} disabled={s.status === "archiviata"}>
                        <Pencil className="h-4 w-4" strokeWidth={2.2} />
                      </IconBtn>
                      {s.status === "archiviata" ? (
                        <IconBtn
                          label="Ripristina"
                          onClick={() => {
                            updateScheda(s.id, { status: "consuntivata" });
                            notify("Scheda ripristinata");
                          }}
                        >
                          <ArchiveRestore className="h-4 w-4" strokeWidth={2.2} />
                        </IconBtn>
                      ) : (
                        <IconBtn label="Archivia" onClick={() => setArchiving(s)} danger>
                          <Archive className="h-4 w-4" strokeWidth={2.2} />
                        </IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length + 1} className="px-4 py-12 text-center">
                  <p className="text-[14px] font-semibold">Nessuna scheda trovata</p>
                  <p className="mt-1 text-[12.5px] text-muted">Prova a modificare i filtri o la ricerca.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && (
        <SchedaView
          scheda={schede.find((x) => x.id === viewing.id) ?? viewing}
          user={byId.get(viewing.userId)}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      )}
      {editing && <SchedaForm scheda={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
      {archiving && (
        <Modal
          title="Archiviare la scheda?"
          onClose={() => setArchiving(null)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setArchiving(null)}>Annulla</GhostButton>
              <PrimaryButton
                onClick={() => {
                  updateScheda(archiving.id, { status: "archiviata" });
                  notify("Scheda archiviata");
                  setArchiving(null);
                }}
              >
                Archivia
              </PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            La scheda <span className="font-semibold text-ink">{archiving.title}</span>
            {byId.get(archiving.userId) && <> di {fullName(byId.get(archiving.userId)!)}</>} non sarà più modificabile. Potrai
            ripristinarla dal filtro <em>Archiviate</em>.
          </p>
        </Modal>
      )}
    </div>
  );
}

function SchedaView({ scheda: s, user, onClose, onEdit }: { scheda: Scheda; user?: User; onClose: () => void; onEdit: () => void }) {
  const score = schedaScore(s);
  return (
    <Modal
      title={s.title}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <GhostButton onClick={onClose}>Chiudi</GhostButton>
          {s.status !== "archiviata" && <PrimaryButton onClick={onEdit}>Modifica</PrimaryButton>}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]">
        {user && (
          <Link href={`/azienda/utenti/${user.id}`} className="font-semibold text-brand hover:underline">
            {fullName(user)}
          </Link>
        )}
        <span className="text-muted">Anno {s.year}</span>
        <StatusPill status={s.status} />
        <span className="ml-auto font-bold tabular-nums">Raggiungimento {score}%</span>
      </div>
      <table className="mt-4 w-full text-left">
        <thead>
          <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
            <th className="py-2">Obiettivo</th>
            <th className="w-16 py-2 text-right">Peso</th>
            <th className="w-40 py-2 pl-4">Raggiunto</th>
          </tr>
        </thead>
        <tbody>
          {s.objectives.map((o) => (
            <tr key={o.id} className="border-b border-line last:border-0">
              <td className="py-2.5 text-[13px] font-semibold">{o.title}</td>
              <td className="py-2.5 text-right text-[13px] tabular-nums text-muted">{o.weight}%</td>
              <td className="py-2.5 pl-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eef1f5]">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(o.achieved, 100)}%` }} />
                  </div>
                  <span className="w-10 text-right text-[12px] font-semibold tabular-nums">{o.achieved}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

function SchedaForm({ scheda, onClose }: { scheda?: Scheda; onClose: () => void }) {
  const { users, addScheda, updateScheda, notify } = useStore();
  const activeUsers = useMemo(
    () => users.filter((u) => u.status === "attivo").sort((a, b) => collator.compare(a.lastName, b.lastName)),
    [users],
  );
  const [userId, setUserId] = useState(scheda?.userId ?? activeUsers[0]?.id ?? "");
  const [year, setYear] = useState(scheda?.year ?? 2026);
  const [title, setTitle] = useState(scheda?.title ?? "");
  const [status, setStatus] = useState<SchedaStatus>(scheda?.status ?? "bozza");
  const [objectives, setObjectives] = useState<Objective[]>(
    scheda?.objectives ?? [{ id: "o-new-0", title: "", weight: 100, achieved: 0 }],
  );
  const [submitted, setSubmitted] = useState(false);

  const totalWeight = objectives.reduce((a, o) => a + (Number(o.weight) || 0), 0);
  const errors: string[] = [];
  if (!title.trim()) errors.push("Inserisci un titolo");
  if (objectives.some((o) => !o.title.trim())) errors.push("Ogni obiettivo deve avere un nome");
  if (totalWeight !== 100) errors.push(`La somma dei pesi deve essere 100% (ora ${totalWeight}%)`);

  const setObj = (id: string, patch: Partial<Objective>) => setObjectives((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  const save = () => {
    setSubmitted(true);
    if (errors.length) return;
    if (scheda) {
      updateScheda(scheda.id, { userId, year, title, status, objectives });
      notify("Scheda aggiornata");
    } else {
      addScheda({ userId, year, title, status, objectives });
      notify("Scheda creata");
    }
    onClose();
  };

  return (
    <Modal
      title={scheda ? "Modifica scheda" : "Nuova scheda obiettivo"}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <GhostButton onClick={onClose}>Annulla</GhostButton>
          <PrimaryButton onClick={save}>{scheda ? "Salva modifiche" : "Crea scheda"}</PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <Field label="Titolo">
            <input autoFocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="es. MBO 2026 · Plant Manager" />
          </Field>
        </div>
        <Field label="Dipendente">
          <select className={inputCls} value={userId} onChange={(e) => setUserId(e.target.value)}>
            {activeUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.lastName} {u.firstName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Anno">
          <select className={inputCls} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {YEARS.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </Field>
        <Field label="Stato">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as SchedaStatus)}>
            {SCHEDA_STATUSES.filter((s) => s.value !== "archiviata").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Obiettivi</span>
          <span className={`text-[12px] font-semibold tabular-nums ${totalWeight === 100 ? "text-emerald-600" : "text-amber-600"}`}>
            Peso totale {totalWeight}%
          </span>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_72px_88px_28px] gap-2 text-[11px] font-semibold text-faint">
            <span>Nome</span>
            <span>Peso %</span>
            <span>Raggiunto %</span>
            <span />
          </div>
          {objectives.map((o) => (
            <div key={o.id} className="grid grid-cols-[1fr_72px_88px_28px] items-center gap-2">
              <input className={inputCls} value={o.title} onChange={(e) => setObj(o.id, { title: e.target.value })} placeholder="Nome obiettivo" />
              <input
                type="number"
                min={0}
                max={100}
                className={inputCls}
                value={o.weight}
                onChange={(e) => setObj(o.id, { weight: Number(e.target.value) })}
              />
              <input
                type="number"
                min={0}
                max={200}
                className={inputCls}
                value={o.achieved}
                onChange={(e) => setObj(o.id, { achieved: Number(e.target.value) })}
              />
              <button
                type="button"
                aria-label="Rimuovi obiettivo"
                disabled={objectives.length === 1}
                onClick={() => setObjectives((os) => os.filter((x) => x.id !== o.id))}
                className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setObjectives((os) => [...os, { id: `o${Date.now()}`, title: "", weight: 0, achieved: 0 }])}
          className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Aggiungi obiettivo
        </button>
      </div>

      {submitted && errors.length > 0 && (
        <ul className="mt-4 space-y-0.5 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors disabled:pointer-events-none disabled:opacity-30 ${
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-brand-soft hover:text-brand"
      }`}
    >
      {children}
    </button>
  );
}

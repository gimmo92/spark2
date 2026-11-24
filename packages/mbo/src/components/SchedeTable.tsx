"use client";

import { useOrg } from "@spark/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  CircleDot,
  Copy,
  Eye,
  Pencil,
  Plus,
  Search,
  Send,
  UserRound,
} from "lucide-react";
import { fullName, type User } from "@spark/core";
import {
  SCHEDA_STATUSES,
  YEARS,
  catalogById,
  cycleLabel,
  cycleYear,
  hasActuals,
  itemDef,
  payoutFor,
  schedaScore,
  statusLabel,
  thresholdMet,
  type Scheda,
  type SchedaStatus,
  formatValue,
  levelsText,
  typeLabel,
  typeOf,
} from "../lib/mbo";
import { useMbo } from "../store";
import { InviaWorkflowModal, WorkflowBadge } from "./InviaWorkflow";
import { Badge, FilterMenu, GhostButton, Modal, PrimaryButton, Tooltip } from "@spark/core";

const STATUS_STYLE: Record<SchedaStatus, string> = {
  bozza: "bg-[#eef1f5] text-[#5b6476]",
  in_approvazione: "bg-amber-50 text-amber-700",
  approvata: "bg-brand-soft text-brand",
  consuntivata: "bg-emerald-50 text-emerald-700",
  archiviata: "bg-[#f1f2f4] text-faint",
};

export function StatusPill({ status }: { status: SchedaStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold ${STATUS_STYLE[status]}`}>{statusLabel(status)}</span>
  );
}

type SortKey = "name" | "cycle" | "team" | "score" | "status" | "updatedAt";
const collator = new Intl.Collator("it", { sensitivity: "base" });

export function SchedeTable() {
  const { teamNames: TEAMS, companies: COMPANIES } = useOrg();
  const router = useRouter();
  const { schede, users, addScheda, updateScheda, notify, objectives, globalGate, canCreateScheda, canEditScheda } = useMbo();
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const [status, setStatus] = useState("");
  const [year, setYear] = useState("2026");
  const [team, setTeam] = useState("");
  const [company, setCompany] = useState("");
  const [showArchived, setShowArchived] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [viewing, setViewing] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Scheda | null>(null);
  const [sending, setSending] = useState<Scheda[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const first = (s: Scheda) => byId.get(s.assigneeIds[0]);
    const val = (s: Scheda, k: SortKey): string | number => {
      if (k === "name") {
        const u = first(s);
        return u ? `${u.lastName} ${u.firstName}` : s.name;
      }
      if (k === "team") return first(s)?.team ?? "";
      if (k === "score") return schedaScore(objectives, s, globalGate);
      if (k === "status") return SCHEDA_STATUSES.findIndex((x) => x.value === s.status);
      return s[k];
    };
    return schede
      .filter((s) => {
        const people = s.assigneeIds.map((id) => byId.get(id)).filter(Boolean) as User[];
        if (status ? s.status !== status : s.status === "archiviata" && !showArchived) return false;
        if (year && cycleYear(s.cycle) !== Number(year)) return false;
        if (team && !people.some((u) => u.team === team)) return false;
        if (company && !people.some((u) => u.company === company)) return false;
        if (needle && !`${people.map(fullName).join(" ")} ${s.name}`.toLowerCase().includes(needle)) return false;
        return true;
      })
      .sort((a, b) => {
        const x = val(a, sort.key);
        const y = val(b, sort.key);
        const c = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
        return c * sort.dir;
      });
  }, [schede, byId, status, year, team, company, showArchived, q, sort, objectives, globalGate]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const anyFilter = status || year !== "2026" || team || company || showArchived || q;
  const viewed = viewing ? schede.find((s) => s.id === viewing) : undefined;

  const cols: { key: SortKey | "objectives"; label: string }[] = [
    { key: "name", label: "Scheda / Assegnatari" },
    { key: "cycle", label: "Ciclo" },
    { key: "team", label: "Team" },
    { key: "objectives", label: "Obiettivi" },
    { key: "score", label: "Payout" },
    { key: "status", label: "Stato" },
    { key: "updatedAt", label: "Aggiornata" },
  ];

  // multi-select: only rows the user may change, and only the ones currently listed
  const selectable = rows.filter((s) => canEditScheda(s));
  const picked = selectable.filter((s) => selected.has(s.id));
  const allOn = selectable.length > 0 && picked.length === selectable.length;

  /** Copies the selected schede as drafts: same objectives and weights, no results, not in any workflow. */
  const duplicate = () => {
    const stamp = Date.now().toString(36);
    for (const s of picked)
      addScheda({
        name: `${s.name} (copia)`,
        assigneeIds: s.assigneeIds,
        cycle: s.cycle,
        status: "bozza",
        items: s.items.map((it, i) => ({ ...it, id: `${it.id}-c${stamp}${i}`, actual: undefined, done: undefined, values: undefined })),
        threshold: s.threshold ? { objectiveId: s.threshold.objectiveId } : undefined,
      });
    notify(picked.length === 1 ? "Scheda duplicata come bozza" : `${picked.length} schede duplicate come bozza`);
    setSelected(new Set());
  };

  return (
    <div className="space-y-3.5">
      {canCreateScheda && (
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/mbo/schede/nuova"
            className="btn-gradient flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[-0.02em] text-white sm:px-5"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Nuova scheda
          </Link>
        </div>
      )}

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
          label="Filtra per gruppo"
          activeLabel="Gruppo"
          value={team}
          onChange={setTeam}
          options={TEAMS.map((t) => ({ value: t, label: t }))}
        />
        <FilterMenu
          icon={<Building2 className="h-3.5 w-3.5 text-[#7d8698]" />}
          label="Filtra per società"
          activeLabel="Società"
          value={company}
          onChange={setCompany}
          options={COMPANIES.map((c) => ({ value: c, label: c }))}
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
              setCompany("");
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
            placeholder="Cerca scheda o assegnatario..."
            className="w-full rounded-lg border border-[#e3e7ee] bg-white py-1.5 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15"
          />
        </div>
      </div>

      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-soft px-3.5 py-2 text-[12.5px]">
          <span className="font-semibold text-brand">
            {picked.length} {picked.length === 1 ? "scheda selezionata" : "schede selezionate"}
          </span>
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {canCreateScheda && (
              <BulkBtn onClick={duplicate}>
                <Copy className="h-3.5 w-3.5" /> Duplica
              </BulkBtn>
            )}
            <BulkBtn onClick={() => setSending(picked.filter((s) => s.status !== "archiviata"))} disabled={picked.every((s) => s.status === "archiviata")}>
              <Send className="h-3.5 w-3.5" /> Invia a workflow
            </BulkBtn>
            <button type="button" onClick={() => setSelected(new Set())} className="px-2 py-1 font-semibold text-muted hover:text-ink">
              Deseleziona
            </button>
          </span>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="w-10 py-2.5 pl-4 pr-1">
                <SelectBox
                  label="Seleziona tutte"
                  checked={allOn}
                  indeterminate={!allOn && picked.length > 0}
                  disabled={!selectable.length}
                  onChange={() => setSelected(allOn ? new Set() : new Set(selectable.map((s) => s.id)))}
                />
              </th>
              {cols.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th key={c.key} className="px-3 py-2.5">
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
              <th className="sticky right-0 w-[140px] border-l border-line bg-white px-3 py-2.5 text-[11px] font-bold uppercase text-[#9aa2b1]">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const people = s.assigneeIds.map((id) => byId.get(id)).filter(Boolean) as User[];
              const score = schedaScore(objectives, s, globalGate);
              const measured = hasActuals(s);
              return (
                <tr
                  key={s.id}
                  className={`group border-b border-line last:border-0 hover:bg-[#f8fafd] ${selected.has(s.id) ? "bg-brand-soft/40" : ""} ${s.status === "archiviata" ? "opacity-60" : ""}`}
                >
                  <td className="w-10 py-[9px] pl-4 pr-1">
                    {canEditScheda(s) && (
                      <SelectBox
                        label={`Seleziona ${s.name}`}
                        checked={selected.has(s.id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const n = new Set(prev);
                            if (n.has(s.id)) n.delete(s.id);
                            else n.add(s.id);
                            return n;
                          })
                        }
                      />
                    )}
                  </td>
                  <td className="px-3 py-[9px]">
                    <button type="button" onClick={() => setViewing(s.id)} className="block text-left">
                      <span className="block max-w-[300px] truncate text-[13.5px] font-semibold text-brand hover:underline" title={s.name}>
                        {s.name}
                      </span>
                      <span className="block max-w-[300px] truncate text-[11.5px] text-muted">
                        {people.length ? fullName(people[0]) : "Nessun assegnatario"}
                        {people.length > 1 && <span className="font-semibold text-ink/70"> +{people.length - 1}</span>}
                      </span>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 text-[12.5px] text-[#5b6476]">{cycleLabel(s.cycle)}</td>
                  <td className="px-3">{people[0]?.team ? <Badge>{people[0].team}</Badge> : <Badge tone="grey">Nessun team</Badge>}</td>
                  <td className="px-3 text-[13px] tabular-nums text-[#5b6476]">
                    <span className="inline-flex items-center gap-1.5">{s.items.length}</span>
                  </td>
                  <td className="px-3">
                    {measured ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#eef1f5]">
                          <div
                            className={`h-full rounded-full ${score >= 100 ? "bg-emerald-500" : score >= 50 ? "bg-brand" : "bg-amber-500"}`}
                            style={{ width: `${Math.min(score, 100)}%` }}
                          />
                        </div>
                        <span className="w-10 text-[12px] font-semibold tabular-nums text-[#5b6476]">{score}%</span>
                      </div>
                    ) : (
                      <span className="text-[12px] text-faint">Da consuntivare</span>
                    )}
                  </td>
                  <td className="px-3">
                    <StatusPill status={s.status} />
                    {s.workflow && (
                      <span className="mt-1 block max-w-[200px]">
                        <WorkflowBadge scheda={s} />
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 text-[12px] tabular-nums text-muted">
                    {new Date(s.updatedAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="sticky right-0 border-l border-line bg-white px-3 py-1 group-hover:bg-[#f8fafd]">
                    <div className="flex items-center gap-0.5">
                      <IconBtn label="Visualizza" onClick={() => setViewing(s.id)}>
                        <Eye className="h-4 w-4" strokeWidth={2.2} />
                      </IconBtn>
                      {canEditScheda(s) && (
                        <IconBtn label="Modifica" onClick={() => router.push(`/mbo/schede/${s.id}`)} disabled={s.status === "archiviata"}>
                          <Pencil className="h-4 w-4" strokeWidth={2.2} />
                        </IconBtn>
                      )}
                      {canEditScheda(s) && (
                        <IconBtn label="Invia a workflow" onClick={() => setSending([s])} disabled={s.status === "archiviata"}>
                          <Send className="h-4 w-4" strokeWidth={2.2} />
                        </IconBtn>
                      )}
                      {!canEditScheda(s) ? null : s.status === "archiviata" ? (
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
                <td colSpan={cols.length + 2} className="px-4 py-12 text-center">
                  <p className="text-[14px] font-semibold">Nessuna scheda trovata</p>
                  <p className="mt-1 text-[12.5px] text-muted">Prova a modificare i filtri o la ricerca.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sending && (
        <InviaWorkflowModal
          schede={sending}
          onClose={(sent) => {
            setSending(null);
            if (sent && sending.length > 1) setSelected(new Set());
          }}
        />
      )}
      {viewed && (
        <SchedaView
          scheda={viewed}
          people={viewed.assigneeIds.map((id) => byId.get(id)).filter(Boolean) as User[]}
          onClose={() => setViewing(null)}
          onEdit={() => router.push(`/mbo/schede/${viewed.id}`)}
        />
      )}
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
            La scheda <span className="font-semibold text-ink">{archiving.name}</span> non sarà più modificabile. Potrai ripristinarla dal filtro{" "}
            <em>Archiviate</em>.
          </p>
        </Modal>
      )}
    </div>
  );
}

function SchedaView({ scheda: s, people, onClose, onEdit }: { scheda: Scheda; people: User[]; onClose: () => void; onEdit: () => void }) {
  const { objectives, globalGate } = useMbo();
  const score = schedaScore(objectives, s, globalGate);
  const gate = s.threshold ? catalogById(objectives, s.threshold.objectiveId) : undefined;
  const measured = hasActuals(s);
  return (
    <Modal
      title={s.name}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <GhostButton onClick={onClose}>Chiudi</GhostButton>
          {s.status !== "archiviata" && <PrimaryButton onClick={onEdit}>Modifica</PrimaryButton>}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px]">
        <span className="text-muted">{cycleLabel(s.cycle)}</span>
        <StatusPill status={s.status} />
        <span className="ml-auto font-bold tabular-nums">{measured ? `Payout ${score}%` : "Da consuntivare"}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {people.map((u) => (
          <Link
            key={u.id}
            href={`/azienda/utenti/${u.id}`}
            className="rounded-md bg-brand-soft px-2 py-0.5 text-[12px] font-semibold text-brand hover:underline"
          >
            {fullName(u)}
          </Link>
        ))}
      </div>

      {gate && (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-[12px] ${thresholdMet(objectives, s) ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}
        >
          <span className="font-bold">Obiettivo soglia:</span> {gate.name} · almeno {formatValue(gate, gate.levels[0].target)}
          {s.threshold?.actual != null && (
            <>
              {" "}
              · consuntivo {formatValue(gate, s.threshold.actual)} — {thresholdMet(objectives, s) ? "raggiunta" : "non raggiunta, payout azzerato"}
            </>
          )}
        </div>
      )}

      <table className="mt-4 w-full text-left">
        <thead>
          <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
            <th className="py-2">Obiettivo</th>
            <th className="w-14 py-2 text-right">Peso</th>
            <th className="w-28 py-2 text-right">Consuntivo</th>
            <th className="w-20 py-2 text-right">Payout</th>
          </tr>
        </thead>
        <tbody>
          {s.items.map((it) => {
            const def = itemDef(objectives, it);
            if (!def) return null;
            return (
              <tr key={it.id} className="border-b border-line last:border-0">
                <td className="py-2.5">
                  <span className="block text-[13px] font-semibold">{def.name}</span>
                  <span className="block text-[11.5px] text-muted">
                    {typeLabel(def)}
                    {typeOf(def) !== "onoff" && ` · ${def.calc === "lineare" ? "Lineare" : "A scaglioni"}`} · {levelsText(def)}
                  </span>
                </td>
                <td className="py-2.5 text-right text-[13px] tabular-nums text-muted">{it.weight}%</td>
                <td className="py-2.5 text-right text-[13px] tabular-nums">{it.actual != null ? formatValue(def, it.actual) : "—"}</td>
                <td className="py-2.5 text-right text-[13px] font-semibold tabular-nums">{it.actual != null ? `${payoutFor(def, it.actual)}%` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors disabled:pointer-events-none disabled:opacity-30 ${
          danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-brand-soft hover:text-brand"
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** Checkbox of the multi-select (supports the "some selected" state for "seleziona tutte"). */
function SelectBox({
  label,
  checked,
  indeterminate,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      title={label}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="h-4 w-4 cursor-pointer accent-brand align-middle disabled:cursor-default disabled:opacity-30"
    />
  );
}

function BulkBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-brand/25 bg-white px-2.5 font-semibold text-brand transition-colors hover:border-brand disabled:opacity-40"
    >
      {children}
    </button>
  );
}

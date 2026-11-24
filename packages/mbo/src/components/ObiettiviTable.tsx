"use client";

import { useOrg } from "@spark/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Eye,
  Gauge,
  Globe,
  Layers,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { fullName } from "@spark/core";
import { CATEGORIES, cycleLabel, schedeUsing, typeLabel, typeOf, type ObjectiveDef } from "../lib/mbo";
import { useCatalogCustomObjectives, useMbo } from "../store";
import { LevelsReadOnly, PayoutCurve } from "./SchedaEditor";
import { MisuraModal } from "./Misura";
import { StatusPill } from "./SchedeTable";
import { FilterMenu, GhostButton, Modal, PrimaryButton, Tooltip, useAccess } from "@spark/core";
import { tr } from "@spark/core";

type SortKey = "name" | "category" | "usage" | "cycle";
const collator = new Intl.Collator("it", { sensitivity: "base" });

const CATEGORY_STYLE: Record<string, string> = {
  Gruppo: "bg-[#1b3f8f] text-white",
  Società: "bg-badge text-white",
  "Business Unit": "bg-cyan-50 text-cyan-800",
  Team: "bg-violet-50 text-violet-700",
  Utente: "bg-[#eef1f5] text-[#5b6476]",
};

/** Icon of each objective level (category). */
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  Gruppo: Globe,
  Società: Building2,
  "Business Unit": Briefcase,
  Team: Users,
  Utente: User,
};

export function CategoryPill({ category }: { category?: string }) {
  if (!category) return <span className="text-[12px] text-faint">—</span>;
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold ${CATEGORY_STYLE[category] ?? "bg-[#eef1f5] text-[#5b6476]"}`}
    >
      {category}
    </span>
  );
}

export function ObiettiviTable() {
  const { companies: COMPANIES } = useOrg();
  const router = useRouter();
  const { objectives, schede, users, updateObjective, deleteObjectives, notify, canEditScheda, mboSettings } = useMbo();
  const { allowed } = useAccess();
  useCatalogCustomObjectives();
  /** The user can enter results for this objective in at least one active scheda (or the global threshold). */
  const canMeasure = (o: ObjectiveDef) =>
    (mboSettings.globalThresholdId === o.id && allowed("mbo.settings.manage")) ||
    schedeUsing(schede, o.id).some((s) => s.status !== "archiviata" && canEditScheda(s));

  const [category, setCategory] = useState("");
  const [company, setCompany] = useState("");
  const [showArchived, setShowArchived] = useState("");
  const [q, setQ] = useState("");
  const [person, setPerson] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [viewing, setViewing] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<ObjectiveDef | null>(null);
  const [measuring, setMeasuring] = useState<ObjectiveDef | null>(null);
  // multiple selection (catalog managers): bulk delete
  const canManage = allowed("mbo.catalog.manage");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // per objective: how many schede use it, and which groups / companies their assignees belong to
  const usageMap = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    const m = new Map<string, { total: number; asThreshold: number; teams: Set<string>; companies: Set<string> }>();
    for (const o of objectives) {
      const using = schedeUsing(schede, o.id);
      const people = using.flatMap((s) => s.assigneeIds.map((id) => byId.get(id))).filter((u) => !!u);
      m.set(o.id, {
        total: using.length,
        asThreshold: using.filter((s) => s.threshold?.objectiveId === o.id).length,
        teams: new Set(people.map((u) => u.team).filter(Boolean)),
        companies: new Set(people.map((u) => u.company)),
      });
    }
    return m;
  }, [objectives, schede, users]);

  // objectives assigned (through a scheda) to people matching the "utente" search
  const personObjectives = useMemo(() => {
    const needle = person.trim().toLowerCase();
    if (!needle) return null;
    const ids = new Set(users.filter((u) => `${fullName(u)} ${u.email}`.toLowerCase().includes(needle)).map((u) => u.id));
    const out = new Set<string>();
    for (const s of schede) {
      if (!s.assigneeIds.some((id) => ids.has(id))) continue;
      for (const it of s.items) if (it.objectiveId) out.add(it.objectiveId);
      if (s.threshold?.objectiveId) out.add(s.threshold.objectiveId);
    }
    return out;
  }, [person, users, schede]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const val = (o: ObjectiveDef, k: SortKey): string | number =>
      k === "usage" ? (usageMap.get(o.id)?.total ?? 0) : k === "category" ? CATEGORIES.indexOf(o.category ?? "") : k === "name" ? o.name : (o[k] ?? "");
    return objectives
      .filter((o) => {
        const u = usageMap.get(o.id);
        if (!!o.archived !== !!showArchived) return false;
        if (category && o.category !== category) return false;
        if (company && !u?.companies.has(company)) return false;
        if (personObjectives && !personObjectives.has(o.id)) return false;
        if (needle && !`${o.name} ${o.description ?? ""}`.toLowerCase().includes(needle)) return false;
        return true;
      })
      .sort((a, b) => {
        const x = val(a, sort.key);
        const y = val(b, sort.key);
        const c = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
        return c * sort.dir;
      });
  }, [objectives, usageMap, category, company, showArchived, q, sort, personObjectives]);

  // selection limited to what the filters show
  const visibleSelected = rows.filter((o) => selected.has(o.id));
  const allVisible = rows.length > 0 && visibleSelected.length === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  // an objective in use (scheda item, personalized copy, scheda threshold, global threshold) can't be deleted: archive it
  const inUse = (o: ObjectiveDef) => (usageMap.get(o.id)?.total ?? 0) > 0 || mboSettings.globalThresholdId === o.id;
  const deletable = visibleSelected.filter((o) => !inUse(o));
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const anyFilter = category || company || showArchived || q || person;
  const viewed = viewing ? objectives.find((o) => o.id === viewing) : undefined;

  const cols: { key: SortKey | "levels"; label: string; sortable: boolean }[] = [
    { key: "name", label: "Obiettivo", sortable: true },
    { key: "category", label: "Livello", sortable: true },
    { key: "usage", label: "Schede", sortable: true },
    { key: "cycle", label: "Ciclo", sortable: true },
  ];

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <h1 className="sr-only">{tr("Obiettivi")}</h1>
        <Link
          href="/mbo/obiettivi/nuovo"
          className="btn-gradient flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[-0.02em] text-white sm:px-5"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} />{" "}{tr("Nuovo obiettivo")}</Link>
        <div className="relative ml-auto w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("Cerca obiettivo...")}
            aria-label={tr("Cerca obiettivo")}
            className="w-full rounded-lg border border-[#e3e7ee] bg-white py-2 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <FilterMenu
          icon={<Tag className="h-3.5 w-3.5 text-[#7d8698]" />}
          label={tr("Livello")}
          activeLabel={tr("Livello")}
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <FilterMenu
          icon={<Building2 className="h-3.5 w-3.5 text-[#7d8698]" />}
          label={tr("Filtra per società")}
          activeLabel={tr("Società")}
          value={company}
          onChange={setCompany}
          options={COMPANIES.map((c) => ({ value: c, label: c }))}
        />
        <label className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] ${person ? "bg-brand-soft text-brand" : "text-[#3f4757]"}`}>
          <User className="h-3.5 w-3.5 shrink-0 text-[#7d8698]" />
          <input
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            list="obiettivi-utenti"
            placeholder={tr("Cerca per utente")}
            aria-label={tr("Cerca obiettivi assegnati a un utente")}
            className="w-[150px] bg-transparent outline-none placeholder:text-[#3f4757]"
          />
          <datalist id="obiettivi-utenti">
            {users
              .filter((u) => u.status === "attivo")
              .map((u) => (
                <option key={u.id} value={fullName(u)} />
              ))}
          </datalist>
        </label>
        <FilterMenu
          icon={<Archive className="h-3.5 w-3.5 text-[#7d8698]" />}
          label={tr("Archiviati")}
          value={showArchived}
          onChange={setShowArchived}
          options={[{ value: "si", label: "Mostra solo archiviati" }]}
        />
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setCategory("");
              setCompany("");
              setShowArchived("");
              setQ("");
              setPerson("");
            }}
            className="px-2 py-1.5 text-[12.5px] font-semibold text-brand hover:underline"
          >{tr("Azzera")}</button>
        )}
      </div>

      {canManage && visibleSelected.length > 0 && (
        <div className="card flex flex-wrap items-center gap-3 px-4 py-2.5">
          <span className="text-[12.5px] font-semibold">{tr("{0} obiettivi selezionati", [visibleSelected.length])}</span>
          <button
            type="button"
            onClick={() => setBulkDeleting(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> {tr("Elimina")}
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[12.5px] font-semibold text-muted hover:text-ink hover:underline">
            {tr("Annulla selezione")}
          </button>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {canManage && (
                <th className="w-[36px] py-2.5 pl-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    aria-label={tr("Seleziona tutti")}
                    checked={allVisible}
                    ref={(el) => {
                      if (el) el.indeterminate = visibleSelected.length > 0 && !allVisible;
                    }}
                    onChange={() => setSelected(allVisible ? new Set() : new Set(rows.map((o) => o.id)))}
                  />
                </th>
              )}
              {cols.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th key={c.key} className="px-3 py-2.5 first:pl-4">
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key as SortKey)}
                        className={`flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold uppercase transition-colors ${
                          active ? "text-[#5c6577]" : "text-[#9aa2b1] hover:text-[#5c6577]"
                        }`}
                      >
                        {tr(c.label)}
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
                    ) : (
                      <span className="whitespace-nowrap text-[11px] font-bold uppercase text-[#9aa2b1]">{tr(c.label)}</span>
                    )}
                  </th>
                );
              })}
              <th className="sticky right-0 w-[140px] border-l border-line bg-white px-3 py-2.5 text-[11px] font-bold uppercase text-[#9aa2b1]">{tr("Azioni")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const u = usageMap.get(o.id) ?? { total: 0, asThreshold: 0 };
              return (
                <tr
                  key={o.id}
                  className={`group border-b border-line last:border-0 hover:bg-[#f8fafd] ${o.archived ? "opacity-60" : ""} ${selected.has(o.id) ? "bg-brand-soft/40" : ""}`}
                >
                  {canManage && (
                    <td className="py-[9px] pl-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand"
                        aria-label={tr("Seleziona {0}", [o.name])}
                        checked={selected.has(o.id)}
                        onChange={() => toggle(o.id)}
                      />
                    </td>
                  )}
                  <td className={`px-3 py-[9px] ${canManage ? "" : "pl-4"}`}>
                    <button type="button" onClick={() => setViewing(o.id)} className="block text-left">
                      <span className="block max-w-[520px] truncate text-[13.5px] font-semibold text-brand hover:underline">{o.name}</span>
                      <span className="block max-w-[520px] truncate text-[11.5px] text-muted" title={tr(o.description)}>
                        {tr(o.description) || typeLabel(o)}
                      </span>
                    </button>
                  </td>
                  <td className="px-3">
                    <CategoryPill category={o.category} />
                  </td>
                  <td className="px-3">
                    <span className="inline-flex items-center gap-1.5 text-[13px] tabular-nums text-[#5b6476]">
                      {u.total || <span className="text-faint">0</span>}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 text-[12.5px] text-[#5b6476]">{o.cycle ? tr(cycleLabel(o.cycle)) : "—"}</td>
                  <td className="sticky right-0 border-l border-line bg-white px-3 py-1 group-hover:bg-[#f8fafd]">
                    <div className="flex items-center gap-0.5">
                      <IconBtn label={tr("Visualizza")} onClick={() => setViewing(o.id)}>
                        <Eye className="h-4 w-4" strokeWidth={2.2} />
                      </IconBtn>
                      <IconBtn label={tr("Misura")} onClick={() => setMeasuring(o)} disabled={o.archived || !canMeasure(o)}>
                        <Gauge className="h-4 w-4" strokeWidth={2.2} />
                      </IconBtn>
                      <IconBtn label={tr("Modifica")} onClick={() => router.push(`/mbo/obiettivi/${o.id}`)} disabled={o.archived}>
                        <Pencil className="h-4 w-4" strokeWidth={2.2} />
                      </IconBtn>
                      {o.archived ? (
                        <IconBtn
                          label={tr("Ripristina")}
                          onClick={() => {
                            updateObjective(o.id, { archived: false });
                            notify(tr("Obiettivo ripristinato"));
                          }}
                        >
                          <ArchiveRestore className="h-4 w-4" strokeWidth={2.2} />
                        </IconBtn>
                      ) : (
                        <IconBtn label={tr("Archivia")} onClick={() => setArchiving(o)} danger>
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
                <td colSpan={cols.length + (canManage ? 2 : 1)} className="px-4 py-12 text-center">
                  <p className="text-[14px] font-semibold">{tr("Nessun obiettivo trovato")}</p>
                  <p className="mt-1 text-[12.5px] text-muted">{tr("Prova a modificare i filtri o la ricerca.")}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {measuring && <MisuraModal def={measuring} onClose={() => setMeasuring(null)} />}
      {viewed && <ObiettivoView def={viewed} onClose={() => setViewing(null)} onEdit={() => router.push(`/mbo/obiettivi/${viewed.id}`)} />}

      {bulkDeleting && (
        <Modal
          title={tr("Eliminare gli obiettivi?")}
          onClose={() => setBulkDeleting(false)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setBulkDeleting(false)}>{tr("Annulla")}</GhostButton>
              <PrimaryButton
                className="!bg-none !bg-red-600 !shadow-none"
                disabled={!deletable.length}
                onClick={() => {
                  const ids = deletable.map((o) => o.id);
                  deleteObjectives(ids);
                  setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))));
                  notify(tr("{0} obiettivi eliminati", [ids.length]));
                  setBulkDeleting(false);
                }}
              >
                {tr("Elimina {0}", [deletable.length])}
              </PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            {deletable.length
              ? tr("{0} obiettivi verranno eliminati definitivamente dal catalogo.", [deletable.length])
              : tr("Nessuno degli obiettivi selezionati può essere eliminato.")}
          </p>
          {visibleSelected.length > deletable.length && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
              {tr("{0} sono usati in schede o come soglia e restano: puoi archiviarli.", [visibleSelected.length - deletable.length])}
            </p>
          )}
        </Modal>
      )}

      {archiving && (
        <Modal
          title={tr("Archiviare l'obiettivo?")}
          onClose={() => setArchiving(null)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setArchiving(null)}>{tr("Annulla")}</GhostButton>
              <PrimaryButton
                onClick={() => {
                  updateObjective(archiving.id, { archived: true });
                  notify(tr("Obiettivo archiviato"));
                  setArchiving(null);
                }}
              >{tr("Archivia")}</PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">{archiving.name}</span>{" "}{tr("non sarà più selezionabile nelle nuove schede.")}</p>
          {(usageMap.get(archiving.id)?.total ?? 0) > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">{tr("È usato in {0} schede: continueranno a usarlo con gli stessi livelli e payout.", [usageMap.get(archiving.id)?.total])}</p>
          )}
        </Modal>
      )}
    </div>
  );
}

function ObiettivoView({ def, onClose, onEdit }: { def: ObjectiveDef; onClose: () => void; onEdit: () => void }) {
  const { schede, users } = useMbo();
  const using = schedeUsing(schede, def.id);
  const byId = new Map(users.map((u) => [u.id, u]));
  return (
    <Modal
      title={def.name}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Chiudi")}</GhostButton>
          {!def.archived && <PrimaryButton onClick={onEdit}>{tr("Modifica")}</PrimaryButton>}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <CategoryPill category={def.category} />
        <span className="rounded-full bg-[#eef1f5] px-2 py-[3px] text-[11px] font-bold text-[#5b6476]">{tr(typeLabel(def))}</span>
        {typeOf(def) !== "onoff" && (
          <span className="rounded-full bg-[#eef1f5] px-2 py-[3px] text-[11px] font-bold text-[#5b6476]">
            {def.calc === "lineare" ? tr("Lineare") : tr("A scaglioni")}
          </span>
        )}
        {typeOf(def) === "quantitativo" && def.unit && <span className="text-[12px] text-muted">{tr("Unità: {0}", [def.unit])}</span>}
        {def.archived && <span className="rounded-full bg-[#f1f2f4] px-2 py-[3px] text-[11px] font-bold text-faint">{tr("Archiviato")}</span>}
      </div>
      {def.description && <p className="mt-3 text-[13px] leading-relaxed text-[#3f4757]">{tr(def.description)}</p>}
      {typeOf(def) === "progetto" && !!def.activities?.length && (
        <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-[12.5px] text-[#3f4757]">
          {def.activities.map((a) => (
            <li key={a.id}>
              {tr(a.title)}
              <span className="ml-1.5 text-muted">
                · {a.kind === "kpi" ? `KPI ${a.target ?? "—"} ${a.unit ?? ""}`.trim() : a.kind === "pct" ? "0-100%" : tr("On/Off")}
                {def.weightedActivities && <span className="tabular-nums">{" "}{tr("· peso {0}%", [a.weight ?? 0])}</span>}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_220px]">
        <LevelsReadOnly def={def} />
        <PayoutCurve def={def} />
      </div>

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
          <Layers className="h-3.5 w-3.5" />{" "}{tr("Usato in {0} {1}", [using.length, using.length === 1 ? tr("scheda") : tr("schede")])}</p>
        {using.length === 0 ? (
          <p className="text-[12.5px] text-muted">{tr("Non è ancora usato in nessuna scheda.")}</p>
        ) : (
          <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {using.map((s) => {
              const first = byId.get(s.assigneeIds[0]);
              return (
                <li key={s.id}>
                  <Link href={`/mbo/schede/${s.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-canvas">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold">{s.name}</span>
                      <span className="block truncate text-[11.5px] text-muted">
                        {first ? fullName(first) : "—"}
                        {s.assigneeIds.length > 1 && ` +${s.assigneeIds.length - 1}`} · {tr(cycleLabel(s.cycle))}
                      </span>
                    </span>
                    {s.threshold?.objectiveId === def.id && (
                      <span className="rounded bg-amber-50 px-1.5 py-[1px] text-[10px] font-bold uppercase text-amber-700">{tr("Soglia")}</span>
                    )}
                    <StatusPill status={s.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
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

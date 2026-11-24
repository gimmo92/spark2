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
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { fullName } from "@spark/core";
import { CATEGORIES, cycleLabel, schedeUsing, typeLabel, typeOf, type ObjectiveDef } from "../lib/mbo";
import { useMbo } from "../store";
import { LevelsReadOnly, PayoutCurve } from "./SchedaEditor";
import { MisuraModal } from "./Misura";
import { StatusPill } from "./SchedeTable";
import { FilterMenu, GhostButton, Modal, PrimaryButton, Tooltip, useAccess } from "@spark/core";

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
  const { objectives, schede, users, updateObjective, notify, canEditScheda, mboSettings } = useMbo();
  const { allowed } = useAccess();
  /** The user can enter results for this objective in at least one active scheda (or the global threshold). */
  const canMeasure = (o: ObjectiveDef) =>
    (mboSettings.globalThresholdId === o.id && allowed("mbo.settings.manage")) ||
    schedeUsing(schede, o.id).some((s) => s.status !== "archiviata" && canEditScheda(s));

  const [category, setCategory] = useState("");
  const [company, setCompany] = useState("");
  const [showArchived, setShowArchived] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [viewing, setViewing] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<ObjectiveDef | null>(null);
  const [measuring, setMeasuring] = useState<ObjectiveDef | null>(null);

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
        if (needle && !`${o.name} ${o.description ?? ""}`.toLowerCase().includes(needle)) return false;
        return true;
      })
      .sort((a, b) => {
        const x = val(a, sort.key);
        const y = val(b, sort.key);
        const c = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
        return c * sort.dir;
      });
  }, [objectives, usageMap, category, company, showArchived, q, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const anyFilter = category || company || showArchived || q;
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
        <h1 className="sr-only">Obiettivi</h1>
        <Link
          href="/mbo/obiettivi/nuovo"
          className="btn-gradient flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[11.5px] font-extrabold uppercase tracking-[-0.02em] text-white sm:px-5"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Nuovo obiettivo
        </Link>
        <div className="relative ml-auto w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca obiettivo..."
            aria-label="Cerca obiettivo"
            className="w-full rounded-lg border border-[#e3e7ee] bg-white py-2 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <FilterMenu
          icon={<Tag className="h-3.5 w-3.5 text-[#7d8698]" />}
          label="Livello"
          activeLabel="Livello"
          value={category}
          onChange={setCategory}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <FilterMenu
          icon={<Building2 className="h-3.5 w-3.5 text-[#7d8698]" />}
          label="Filtra per società"
          activeLabel="Società"
          value={company}
          onChange={setCompany}
          options={COMPANIES.map((c) => ({ value: c, label: c }))}
        />
        <FilterMenu
          icon={<Archive className="h-3.5 w-3.5 text-[#7d8698]" />}
          label="Archiviati"
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
            }}
            className="px-2 py-1.5 text-[12.5px] font-semibold text-brand hover:underline"
          >
            Azzera
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
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
                    ) : (
                      <span className="whitespace-nowrap text-[11px] font-bold uppercase text-[#9aa2b1]">{c.label}</span>
                    )}
                  </th>
                );
              })}
              <th className="sticky right-0 w-[140px] border-l border-line bg-white px-3 py-2.5 text-[11px] font-bold uppercase text-[#9aa2b1]">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const u = usageMap.get(o.id) ?? { total: 0, asThreshold: 0 };
              return (
                <tr key={o.id} className={`group border-b border-line last:border-0 hover:bg-[#f8fafd] ${o.archived ? "opacity-60" : ""}`}>
                  <td className="px-3 py-[9px] pl-4">
                    <button type="button" onClick={() => setViewing(o.id)} className="block text-left">
                      <span className="block max-w-[520px] truncate text-[13.5px] font-semibold text-brand hover:underline">{o.name}</span>
                      <span className="block max-w-[520px] truncate text-[11.5px] text-muted" title={o.description}>
                        {o.description || "Nessuna descrizione"}
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
                  <td className="whitespace-nowrap px-3 text-[12.5px] text-[#5b6476]">{o.cycle ? cycleLabel(o.cycle) : "—"}</td>
                  <td className="sticky right-0 border-l border-line bg-white px-3 py-1 group-hover:bg-[#f8fafd]">
                    <div className="flex items-center gap-0.5">
                      <IconBtn label="Visualizza" onClick={() => setViewing(o.id)}>
                        <Eye className="h-4 w-4" strokeWidth={2.2} />
                      </IconBtn>
                      <IconBtn label="Misura" onClick={() => setMeasuring(o)} disabled={o.archived || !canMeasure(o)}>
                        <Gauge className="h-4 w-4" strokeWidth={2.2} />
                      </IconBtn>
                      <IconBtn label="Modifica" onClick={() => router.push(`/mbo/obiettivi/${o.id}`)} disabled={o.archived}>
                        <Pencil className="h-4 w-4" strokeWidth={2.2} />
                      </IconBtn>
                      {o.archived ? (
                        <IconBtn
                          label="Ripristina"
                          onClick={() => {
                            updateObjective(o.id, { archived: false });
                            notify("Obiettivo ripristinato");
                          }}
                        >
                          <ArchiveRestore className="h-4 w-4" strokeWidth={2.2} />
                        </IconBtn>
                      ) : (
                        <IconBtn label="Archivia" onClick={() => setArchiving(o)} danger>
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
                  <p className="text-[14px] font-semibold">Nessun obiettivo trovato</p>
                  <p className="mt-1 text-[12.5px] text-muted">Prova a modificare i filtri o la ricerca.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {measuring && <MisuraModal def={measuring} onClose={() => setMeasuring(null)} />}
      {viewed && <ObiettivoView def={viewed} onClose={() => setViewing(null)} onEdit={() => router.push(`/mbo/obiettivi/${viewed.id}`)} />}

      {archiving && (
        <Modal
          title="Archiviare l'obiettivo?"
          onClose={() => setArchiving(null)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setArchiving(null)}>Annulla</GhostButton>
              <PrimaryButton
                onClick={() => {
                  updateObjective(archiving.id, { archived: true });
                  notify("Obiettivo archiviato");
                  setArchiving(null);
                }}
              >
                Archivia
              </PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">{archiving.name}</span> non sarà più selezionabile nelle nuove schede.
          </p>
          {(usageMap.get(archiving.id)?.total ?? 0) > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
              È usato in {usageMap.get(archiving.id)?.total} schede: continueranno a usarlo con gli stessi livelli e payout.
            </p>
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
          <GhostButton onClick={onClose}>Chiudi</GhostButton>
          {!def.archived && <PrimaryButton onClick={onEdit}>Modifica</PrimaryButton>}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <CategoryPill category={def.category} />
        <span className="rounded-full bg-[#eef1f5] px-2 py-[3px] text-[11px] font-bold text-[#5b6476]">{typeLabel(def)}</span>
        {typeOf(def) !== "onoff" && (
          <span className="rounded-full bg-[#eef1f5] px-2 py-[3px] text-[11px] font-bold text-[#5b6476]">
            {def.calc === "lineare" ? "Lineare" : "A scaglioni"}
          </span>
        )}
        {typeOf(def) === "quantitativo" && def.unit && <span className="text-[12px] text-muted">Unità: {def.unit}</span>}
        {def.archived && <span className="rounded-full bg-[#f1f2f4] px-2 py-[3px] text-[11px] font-bold text-faint">Archiviato</span>}
      </div>
      {def.description && <p className="mt-3 text-[13px] leading-relaxed text-[#3f4757]">{def.description}</p>}
      {typeOf(def) === "progetto" && !!def.activities?.length && (
        <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-[12.5px] text-[#3f4757]">
          {def.activities.map((a) => (
            <li key={a.id}>
              {a.title}
              <span className="ml-1.5 text-muted">
                · {a.kind === "kpi" ? `KPI ${a.target ?? "—"} ${a.unit ?? ""}`.trim() : a.kind === "pct" ? "0-100%" : "On/Off"}
                {def.weightedActivities && <span className="tabular-nums"> · peso {a.weight ?? 0}%</span>}
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
          <Layers className="h-3.5 w-3.5" /> Usato in {using.length} {using.length === 1 ? "scheda" : "schede"}
        </p>
        {using.length === 0 ? (
          <p className="text-[12.5px] text-muted">Non è ancora usato in nessuna scheda.</p>
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
                        {s.assigneeIds.length > 1 && ` +${s.assigneeIds.length - 1}`} · {cycleLabel(s.cycle)}
                      </span>
                    </span>
                    {s.threshold?.objectiveId === def.id && (
                      <span className="rounded bg-amber-50 px-1.5 py-[1px] text-[10px] font-bold uppercase text-amber-700">Soglia</span>
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

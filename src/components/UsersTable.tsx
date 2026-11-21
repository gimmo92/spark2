"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Diamond,
  Eye,
  RotateCcw,
  Search,
  Settings,
  UserCheck,
  UserPen,
  UserRound,
  UserX,
  Users,
} from "lucide-react";
import { ACCESS_LEVELS, COMPANIES, TEAMS, fullName, type User } from "@/lib/data";
import { useStore } from "@/lib/store";
import { Badge, FilterMenu, GhostButton, Modal, Popover, PrimaryButton, Tooltip } from "./ui";
import { UserFormModal } from "./UserForm";
import { InviteIconButton } from "./InviteAction";

type SortKey = "name" | "level" | "email" | "team" | "role";
type ColKey = SortKey | "company" | "status";

const COLS: { key: ColKey; label: string; sortable: boolean }[] = [
  { key: "name", label: "Nome", sortable: true },
  { key: "level", label: "Livello", sortable: true },
  { key: "email", label: "Email", sortable: true },
  { key: "team", label: "Team", sortable: true },
  { key: "role", label: "Ruolo", sortable: true },
  { key: "company", label: "Società", sortable: false },
];

const PAGE = 25;
const collator = new Intl.Collator("it", { sensitivity: "base" });

const sortValue = (u: User, k: SortKey) =>
  k === "name" ? `${u.lastName} ${u.firstName}` : k === "level" ? String(ACCESS_LEVELS.indexOf(u.level)) : u[k];

function downloadCsv(rows: User[]) {
  const header = ["Nome", "Cognome", "Email", "Livello di accesso", "Team", "Società", "Ruolo", "Stato", "Data creazione"];
  const esc = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = rows.map((u) =>
    [u.firstName, u.lastName, u.email, u.level, u.team, u.company, u.role, u.status, u.createdAt].map(esc).join(";"),
  );
  const blob = new Blob(["﻿" + [header.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `utenti-spark-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function UsersTable() {
  const { users, updateUser, notify, resetData } = useStore();

  const [quick, setQuick] = useState("");
  const [status, setStatus] = useState("attivo");
  const [level, setLevel] = useState("");
  const [team, setTeam] = useState("");
  const [company, setCompany] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [visible, setVisible] = useState(PAGE);
  const [hidden, setHidden] = useState<Set<ColKey>>(new Set(["company", "status"]));
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [confirm, setConfirm] = useState<User | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cutoff = new Date(Date.UTC(2026, 10, 20) - 90 * 864e5).toISOString().slice(0, 10);
    const out = users.filter(
      (u) =>
        (!status || u.status === status) &&
        (!level || u.level === level) &&
        (!team || u.team === team) &&
        (!company || u.company === company) &&
        (quick !== "noteam" || !u.team) &&
        (quick !== "recent" || u.createdAt >= cutoff) &&
        (!needle ||
          u.email.toLowerCase().includes(needle) ||
          fullName(u).toLowerCase().includes(needle) ||
          `${u.lastName} ${u.firstName}`.toLowerCase().includes(needle)),
    );
    return out.sort((a, b) => collator.compare(sortValue(a, sort.key), sortValue(b, sort.key)) * sort.dir);
  }, [users, status, level, team, company, quick, q, sort]);

  // reset paging whenever the result set definition changes
  const filterKey = `${status}|${level}|${team}|${company}|${quick}|${q}|${sort.key}|${sort.dir}`;
  const [lastKey, setLastKey] = useState(filterKey);
  if (lastKey !== filterKey) {
    setLastKey(filterKey);
    setVisible(PAGE);
  }

  const rows = filtered.slice(0, visible);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setVisible((v) => Math.min(v + PAGE, filtered.length)),
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const cols = COLS.filter((c) => !hidden.has(c.key));
  const showStatus = !hidden.has("status");
  const title =
    status === "attivo"
      ? "Utenti Attivi Registrati Alla Piattaforma"
      : status === "disattivato"
        ? "Utenti Disattivati"
        : "Tutti Gli Utenti Della Piattaforma";
  const progress = filtered.length ? Math.min(rows.length / filtered.length, 1) : 0;
  const anyFilter = quick || status !== "attivo" || level || team || company || q;

  return (
    <div className="space-y-3.5">
      {/* actions */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button type="button" onClick={() => setEditing("new")} className="btn-gradient rounded-lg px-4 py-2.5 text-[11.5px] sm:px-5 font-extrabold uppercase tracking-[-0.02em] text-white">
          Nuovo utente
        </button>
        <button
          type="button"
          onClick={() => {
            downloadCsv(filtered);
            notify(`Esportati ${filtered.length} utenti`);
          }}
          className="btn-gradient rounded-lg px-4 py-2.5 text-[11.5px] sm:px-5 font-extrabold uppercase tracking-[-0.02em] text-white"
        >
          Esporta utenti
        </button>
        <div className="ml-auto">
          <Popover
            trigger={(toggle, open) => (
              <button
                type="button"
                onClick={toggle}
                aria-label="Impostazioni tabella"
                aria-expanded={open}
                className="card grid h-9 w-9 place-items-center !rounded-xl text-brand transition-transform active:scale-95"
              >
                <Settings className="h-4 w-4 fill-brand/15" strokeWidth={2.4} />
              </button>
            )}
          >
            <p className="px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-muted">Colonne visibili</p>
            {[...COLS.slice(1), { key: "status" as ColKey, label: "Stato" }].map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-canvas">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand"
                  checked={!hidden.has(c.key)}
                  onChange={() =>
                    setHidden((h) => {
                      const n = new Set(h);
                      if (n.has(c.key)) n.delete(c.key);
                      else n.add(c.key);
                      return n;
                    })
                  }
                />
                {c.label}
              </label>
            ))}
            <div className="my-1.5 border-t border-line" />
            <button
              type="button"
              onClick={() => {
                resetData();
                notify("Dati demo ripristinati");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-muted hover:bg-canvas hover:text-ink"
            >
              <RotateCcw className="h-4 w-4" /> Ripristina dati demo
            </button>
          </Popover>
        </div>
      </div>

      {/* title card */}
      <div className="card overflow-hidden px-4 pb-3 pt-2.5">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-[14px] font-semibold text-ink">{title}</h1>
          <span className="text-[13px] font-semibold tabular-nums text-ink">
            {rows.length}/{filtered.length}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#eef1f5]">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(progress * 100, filtered.length ? 2 : 0)}%` }}
          />
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <FilterMenu
          icon={<Users className="h-4 w-4 text-[#7d8698]" />}
          label="Filtra utenti"
          activeLabel="Utenti"
          value={quick}
          onChange={setQuick}
          options={[
            { value: "noteam", label: "Senza team" },
            { value: "recent", label: "Aggiunti negli ultimi 90 giorni" },
          ]}
        />
        <FilterMenu
          icon={<span className="h-1.5 w-1.5 rounded-full bg-faint" />}
          label="Stato account"
          value={status}
          onChange={setStatus}
          options={[
            { value: "attivo", label: "Attivo" },
            { value: "disattivato", label: "Disattivato" },
          ]}
        />
        <FilterMenu
          icon={<Diamond className="h-3 w-3 text-[#7d8698]" />}
          label="Filtra per livello di accesso"
          activeLabel="Livello"
          value={level}
          onChange={setLevel}
          options={ACCESS_LEVELS.map((l) => ({ value: l, label: l.charAt(0) + l.slice(1).toLowerCase() }))}
        />
        <FilterMenu
          icon={<UserRound className="h-4 w-4 fill-[#7d8698] text-[#7d8698]" />}
          label="Filtra per team"
          activeLabel="Team"
          value={team}
          onChange={setTeam}
          options={TEAMS.map((t) => ({ value: t, label: t }))}
        />
        <FilterMenu
          icon={<Building2 className="h-4 w-4 text-[#7d8698]" />}
          label="Filtra per società"
          activeLabel="Società"
          value={company}
          onChange={setCompany}
          options={COMPANIES.map((c) => ({ value: c, label: c }))}
        />
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setQuick("");
              setStatus("attivo");
              setLevel("");
              setTeam("");
              setCompany("");
              setQ("");
            }}
            className="px-2 py-2 text-[12.5px] font-semibold text-brand hover:underline"
          >
            Azzera
          </button>
        )}
        <div className="relative ml-auto w-full sm:w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca per email, nome o cognome..."
            className="w-full rounded-lg border border-[#e3e7ee] bg-white py-1.5 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-faint focus:border-brand focus:ring-3 focus:ring-brand/15"
          />
        </div>
      </div>

      {/* table */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
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
                        className={`flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.01em] transition-colors ${
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
                      <span className="text-[11px] font-bold uppercase text-[#9aa2b1]">{c.label}</span>
                    )}
                  </th>
                );
              })}
              <th className="sticky right-0 w-[136px] border-l border-line bg-white px-3 py-2.5 text-[11px] font-bold uppercase text-[#9aa2b1]">
                Azioni
              </th>
              {showStatus && <th className="px-3 py-2.5 text-[11px] font-bold uppercase text-[#c3c8d1]">Stato</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="group border-b border-line last:border-0 hover:bg-[#f8fafd]">
                {cols.map((c) => (
                  <td key={c.key} className="px-3 py-[9px] first:pl-4">
                    {c.key === "name" && (
                      <Link
                        href={`/azienda/utenti/${u.id}`}
                        className="whitespace-nowrap text-[13.5px] font-semibold text-brand hover:text-brand-dark hover:underline"
                      >
                        {fullName(u)}
                      </Link>
                    )}
                    {c.key === "level" && <Badge tone={u.level === "ADMIN" ? "navy" : "blue"}>{u.level}</Badge>}
                    {c.key === "email" && <span className="text-[13px] text-[#5b6476]">{u.email}</span>}
                    {c.key === "team" && (u.team ? <Badge>{u.team}</Badge> : <Badge tone="grey">Nessun team</Badge>)}
                    {c.key === "role" && <span title={u.role} className="block min-w-[170px] max-w-[280px] truncate text-[13px] text-[#5b6476]">{u.role}</span>}
                    {c.key === "company" && <span className="whitespace-nowrap text-[13px] text-[#5b6476]">{u.company}</span>}
                  </td>
                ))}
                <td className="sticky right-0 border-l border-line bg-white px-3 py-1 group-hover:bg-[#f8fafd]">
                  <div className="flex items-center gap-0.5">
                    <IconBtn label="Visualizza" href={`/azienda/utenti/${u.id}`}>
                      <Eye className="h-4 w-4 fill-current stroke-white" strokeWidth={2} />
                    </IconBtn>
                    <IconBtn label="Modifica" onClick={() => setEditing(u)}>
                      <UserPen className="h-4 w-4" strokeWidth={2.2} />
                    </IconBtn>
                    <InviteIconButton user={u} />
                    {u.status === "attivo" ? (
                      <IconBtn label="Disattiva account" onClick={() => setConfirm(u)} danger>
                        <UserX className="h-4 w-4" strokeWidth={2.2} />
                      </IconBtn>
                    ) : (
                      <IconBtn
                        label="Riattiva account"
                        onClick={() => {
                          updateUser(u.id, { status: "attivo" });
                          notify(`${fullName(u)} riattivato`);
                        }}
                      >
                        <UserCheck className="h-4 w-4" strokeWidth={2.2} />
                      </IconBtn>
                    )}
                  </div>
                </td>
                {showStatus && (
                  <td className="px-3">
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold ${
                        u.status === "attivo" ? "text-emerald-600" : "text-faint"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${u.status === "attivo" ? "bg-emerald-500" : "bg-faint"}`} />
                      {u.status === "attivo" ? "Attivo" : "Disattivato"}
                    </span>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={cols.length + 2} className="px-4 py-12 text-center">
                  <p className="text-[13px] font-semibold">Nessun utente trovato</p>
                  <p className="mt-1 text-[12.5px] text-muted">Prova a modificare i filtri o la ricerca.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {rows.length < filtered.length && (
          <div ref={sentinel} className="py-5 text-center text-[12px] text-muted">
            Caricamento…
          </div>
        )}
      </div>

      {editing && <UserFormModal user={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}

      {confirm && (
        <Modal
          title="Disattivare l'account?"
          onClose={() => setConfirm(null)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setConfirm(null)}>Annulla</GhostButton>
              <PrimaryButton
                className="!bg-none !bg-red-600 !shadow-none"
                onClick={() => {
                  updateUser(confirm.id, { status: "disattivato" });
                  notify(`${fullName(confirm)} disattivato`);
                  setConfirm(null);
                }}
              >
                Disattiva
              </PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">{fullName(confirm)}</span> non potrà più accedere alla piattaforma.
            Potrai riattivare l&apos;account in qualsiasi momento dal filtro <em>Stato account: Disattivato</em>.
          </p>
        </Modal>
      )}
    </div>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  href,
  danger,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const cls = `grid h-7 w-7 place-items-center rounded-md text-[#6c7486] transition-colors ${
    danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-brand-soft hover:text-brand"
  }`;
  if (href)
    return (
      <Tooltip label={label}>
        {href.startsWith("/") ? (
      <Link href={href} aria-label={label} className={cls}>
        {children}
      </Link>
    ) : (
      <a href={href} aria-label={label} className={cls}>
        {children}
      </a>
        )}
      </Tooltip>
    );
  return (
    <Tooltip label={label}>
      <button type="button" onClick={onClick} aria-label={label} className={cls}>
        {children}
      </button>
    </Tooltip>
  );
}

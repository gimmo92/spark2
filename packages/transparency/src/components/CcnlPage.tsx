"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { BookOpen, FileUp, Loader2, Pencil } from "lucide-react";
import { Badge, Field, GhostButton, Modal, PrimaryButton, Tooltip, inputCls, localeTag, tr, useAccess, useData } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import { LevelTaxonomy } from "../lib/analysis/LevelTaxonomy";
import { personPay } from "../lib/analysis/RgaComponents";
import { SalaryMath } from "../lib/analysis/SalaryMath";
import { libraryFor, minimumFor, type CcnlRow, type CcnlTableDoc } from "../lib/ccnl";
import type { Employee } from "../lib/models/Employee";
import { SALARY_METRICS } from "../lib/models/constants";
import { roleId } from "../lib/roleWeights";
import { useCcnlTables, usePayAnalyses } from "../store";
import { eur, gap } from "./format";
import { ExpandToggle, PersonName, type PersonOpener } from "./GroupPeople";

const ERRORS: Record<string, string> = {
  ai_config: "Servizio AI non configurato: manca la chiave ANTHROPIC_API_KEY sul server.",
  ai: "Lettura del PDF non riuscita. Riprova o compila la tabella a mano.",
  rate: "Troppe richieste ravvicinate: riprova tra qualche minuto.",
  forbidden: "Non hai il permesso di modificare le tabelle dei minimi.",
  body: "PDF non valido o troppo grande: indica solo le pagine con le tabelle.",
};

const base = (e: Employee) => {
  const v = personPay(e, SALARY_METRICS.base);
  return v != null && v > 0 ? v : null;
};
const median = (v: number[]) => (v.length ? SalaryMath.median(v) : null);
const today = () => new Date().toISOString().slice(0, 10);

/** One person checked against the official minimum of their CCNL level. */
interface Checked {
  e: Employee;
  minAnnual: number;
  minMonthly: number | null;
  classNo: number | null;
  fileMonthly: number | null;
  pay: number | null;
  below: boolean;
  /** Minimum written in the payroll file differs from the official one (more than 1%). */
  fileOff: boolean;
}

/**
 * Compensation → Minimi CCNL: the official minimum pay of each contract in the uploaded data (from
 * Spark's library of official tables, read from the agreement PDF by the AI and reviewed, or typed
 * in), and the check of every person: pay under the minimum, minimum in the payroll file not aligned.
 */
export function CcnlPage({ uploadHref = "/caricamento-dati", employeeHref = "/trasparenza/dipendente" }: { uploadHref?: string; employeeHref?: string }) {
  const { analyses } = usePayAnalyses();
  const { tables, upsert } = useCcnlTables();
  const { allowed } = useAccess();
  const canManage = allowed("transparency.manage");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const doc = analyses.find((a) => a.id === params.get("analisi")) ?? analyses[0];
  const people = useMemo(() => (doc ? (CompensationAnalysis.fromSnapshot(doc.snapshot)?.employees ?? []) : []), [doc]);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const contracts = useMemo(() => {
    const m = new Map<string, Employee[]>();
    for (const e of people) {
      const k = String(e.ccnl ?? "").trim();
      if (k) m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [people]);

  const check = (table: CcnlTableDoc, list: Employee[]): Checked[] =>
    list.flatMap((e) => {
      const min = minimumFor(table, e);
      if (!min) return [];
      const pay = base(e);
      const fileMonthly = e.ccnlMinimum ?? null;
      return [
        {
          e,
          minAnnual: min.annual,
          minMonthly: min.monthly,
          classNo: min.classNo,
          fileMonthly,
          pay,
          below: pay != null && pay < min.annual - 0.5,
          fileOff: min.monthly != null && fileMonthly != null && Math.abs(fileMonthly - min.monthly) > min.monthly * 0.01,
        },
      ];
    });

  const all = contracts.flatMap(([ccnl, list]) => (tables.get(ccnl) ? check(tables.get(ccnl)!, list) : []));
  const missing = contracts.filter(([ccnl]) => !tables.get(ccnl)).length;
  const opener: PersonOpener = { href: (e) => `${employeeHref}?analisi=${encodeURIComponent(doc?.id ?? "")}&dip=${e.index}` };

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-[14px] font-semibold">{tr("Minimi CCNL")}</h1>
        {analyses.length > 1 && doc && (
          <label className="flex items-center gap-2 text-[12.5px] text-muted">
            {tr("Dati")}
            <select
              value={doc.id}
              onChange={(e) => router.replace(`${pathname}?analisi=${encodeURIComponent(e.target.value)}`, { scroll: false })}
              className="rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] font-semibold text-ink outline-none focus:border-brand"
            >
              {analyses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {new Date(a.createdAt).toLocaleDateString(localeTag())}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {!doc ? (
        <div className="card px-5 py-10 text-center text-[12.5px] text-muted">
          {tr("Nessun dato caricato.")}{" "}
          {canManage && (
            <Link href={uploadHref} className="font-semibold text-brand hover:underline">
              {tr("Carica il tracciato retributivo")}
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Persone confrontate", value: String(all.length) },
              { label: "Sotto il minimo", value: String(all.filter((c) => c.below).length), tone: all.some((c) => c.below) ? "text-red-600" : "text-emerald-700" },
              { label: "Minimo nel file non allineato", value: String(all.filter((c) => c.fileOff).length), tone: all.some((c) => c.fileOff) ? "text-amber-700" : "" },
              { label: "Contratti senza tabella", value: String(missing), tone: missing ? "text-amber-700" : "" },
            ].map((k) => (
              <div key={k.label} className="card px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr(k.label)}</p>
                <p className={`mt-1 text-[20px] font-extrabold tabular-nums ${k.tone ?? ""}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {contracts.map(([ccnl, list]) => {
            const table = tables.get(ccnl);
            const checked = table ? check(table, list) : [];
            const expired = table?.expires && table.expires < today();
            const levels = new Map<string, Checked[]>();
            for (const c of checked) {
              const k = LevelTaxonomy.displayLabel(c.e.level);
              levels.set(k, [...(levels.get(k) ?? []), c]);
            }
            const unmatched = list.length - checked.length;
            return (
              <div key={ccnl} className="card overflow-x-auto">
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
                  <p className="text-[13px] font-semibold">{ccnl}</p>
                  <span className="text-[12px] text-muted">{tr("{0} persone", [list.length])}</span>
                  {table ? (
                    <Tooltip label={table.source}>
                      <Badge tone="navy">
                        {table.validFrom ? tr("Tabella dal {0}", [new Date(table.validFrom).toLocaleDateString(localeTag())]) : tr("Tabella configurata")}
                      </Badge>
                    </Tooltip>
                  ) : (
                    <Badge tone="grey">{tr("Tabella dei minimi da configurare")}</Badge>
                  )}
                  {expired && <Badge tone="grey">{tr("Contratto scaduto, in ultrattività")}</Badge>}
                  {canManage && (
                    <GhostButton onClick={() => setEditing(ccnl)} className="ml-auto flex items-center gap-1.5">
                      <Pencil className="h-3.5 w-3.5" /> {table ? tr("Modifica tabella") : tr("Configura tabella")}
                    </GhostButton>
                  )}
                </div>
                {table && (
                  <>
                    <table className="w-full min-w-[820px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
                          <th className="px-3 py-2.5 pl-4">{tr("Livello")}</th>
                          <th className="px-3 py-2.5 text-right">{tr("Persone")}</th>
                          <th className="px-3 py-2.5 text-right">{tr("Minimo annuo (mediana)")}</th>
                          <th className="px-3 py-2.5 text-right">{tr("RAL FTE (mediana)")}</th>
                          <th className="px-3 py-2.5 text-right">{tr("Sopra il minimo (mediana)")}</th>
                          <th className="px-3 py-2.5 text-right">{tr("Sotto il minimo")}</th>
                          <th className="px-3 py-2.5 pr-4 text-right">{tr("Minimo nel file non allineato")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...levels.entries()].map(([lvl, rows]) => {
                          const key = `${ccnl}|${lvl}`;
                          const pcts = rows.filter((r) => r.pay != null).map((r) => ((r.pay! - r.minAnnual) / r.minAnnual) * 100);
                          const below = rows.filter((r) => r.below).length;
                          const off = rows.filter((r) => r.fileOff).length;
                          return (
                            <Fragment key={key}>
                              <tr className="border-b border-line text-[12.5px] last:border-0 hover:bg-[#f8fafd]">
                                <td className="px-3 py-2 pl-3 font-semibold">
                                  <ExpandToggle open={!!open[key]} label={lvl} onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))} />
                                  {lvl}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">{rows.length}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{eur(median(rows.map((r) => r.minAnnual)))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{eur(median(rows.map((r) => r.pay).filter((x): x is number => x != null)))}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{gap(median(pcts))}</td>
                                <td className={`px-3 py-2 text-right tabular-nums ${below ? "font-semibold text-red-600" : "text-muted"}`}>{below}</td>
                                <td className={`px-3 py-2 pr-4 text-right tabular-nums ${off ? "font-semibold text-amber-700" : "text-muted"}`}>{off}</td>
                              </tr>
                              {open[key] && (
                                <tr className="border-b border-line">
                                  <td colSpan={7} className="bg-[#fafbfd] px-4 py-2">
                                    <table className="w-full min-w-[760px] border-collapse text-left text-[12px]">
                                      <thead>
                                        <tr className="text-[10.5px] font-bold uppercase text-[#9aa2b1]">
                                          <th className="py-1.5 pl-6 pr-3">{tr("Dipendente")}</th>
                                          <th className="px-3 py-1.5 text-right">{tr("Classe")}</th>
                                          <th className="px-3 py-1.5 text-right">{tr("Minimo mensile ufficiale")}</th>
                                          <th className="px-3 py-1.5 text-right">{tr("Minimo mensile nel file")}</th>
                                          <th className="px-3 py-1.5 text-right">{tr("Minimo annuo")}</th>
                                          <th className="px-3 py-1.5 text-right">{tr("RAL FTE")}</th>
                                          <th className="px-3 py-1.5 text-right">{tr("Scarto")}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {[...rows]
                                          .sort((a, b) => (a.pay ?? 0) - a.minAnnual - ((b.pay ?? 0) - b.minAnnual))
                                          .map((r) => (
                                            <tr key={r.e.index} className="border-t border-line">
                                              <td className="py-1.5 pl-6 pr-3">
                                                <PersonName person={r.e} opener={opener} />
                                              </td>
                                              <td className="px-3 py-1.5 text-right tabular-nums text-muted">{r.classNo ?? "–"}</td>
                                              <td className="px-3 py-1.5 text-right tabular-nums">{eur(r.minMonthly)}</td>
                                              <td className={`px-3 py-1.5 text-right tabular-nums ${r.fileOff ? "font-semibold text-amber-700" : ""}`}>{eur(r.fileMonthly)}</td>
                                              <td className="px-3 py-1.5 text-right tabular-nums">{eur(r.minAnnual)}</td>
                                              <td className="px-3 py-1.5 text-right tabular-nums">{eur(r.pay)}</td>
                                              <td className={`px-3 py-1.5 text-right tabular-nums ${r.below ? "font-semibold text-red-600" : "text-muted"}`}>
                                                {r.pay == null ? "–" : eur(r.pay - r.minAnnual)}
                                              </td>
                                            </tr>
                                          ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    {(unmatched > 0 || table.note) && (
                      <p className="border-t border-line px-4 py-2 text-[11.5px] text-muted">
                        {unmatched > 0 && tr("{0} persone con un livello che non è nella tabella. ", [unmatched])}
                        {table.note}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </>
      )}

      {editing && (
        <TableEditor
          ccnl={editing}
          levels={[...new Set(contracts.find(([c]) => c === editing)?.[1].map((e) => LevelTaxonomy.displayLabel(e.level).replace(/^Livello\s*/i, "")) ?? [])]}
          table={tables.get(editing)}
          onClose={() => setEditing(null)}
          onSave={(t) => {
            upsert(t);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/** "63, 65, 70-72" → zero-based page indexes. */
const parsePages = (spec: string, count: number) =>
  [
    ...new Set(
      spec
        .split(/[,;\s]+/)
        .filter(Boolean)
        .flatMap((p) => {
          const [a, b] = p.split("-").map((x) => Number(x));
          if (!a) return [];
          const end = b && b >= a ? b : a;
          return Array.from({ length: Math.min(60, end - a + 1) }, (_, i) => a + i - 1);
        })
        .filter((i) => i >= 0 && i < count),
    ),
  ];

const rowText = (r: CcnlRow) => (r.annual != null ? "" : (r.monthly ?? []).map((v) => v.toLocaleString("it-IT", { minimumFractionDigits: 2 })).join("; "));
const parseValues = (s: string) =>
  s
    .split(";")
    .map((x) => Number(x.trim().replace(/\./g, "").replace(",", ".")))
    .filter((v) => Number.isFinite(v) && v > 0);

/** Editor of a CCNL minimum table: from Spark's library, read from the agreement PDF, or by hand. */
function TableEditor({ ccnl, levels, table, onClose, onSave }: { ccnl: string; levels: string[]; table?: CcnlTableDoc; onClose: () => void; onSave: (t: CcnlTableDoc) => void }) {
  const email = useData().viewer?.email;
  const library = libraryFor(ccnl);
  const [draft, setDraft] = useState<Omit<CcnlTableDoc, "id" | "updatedAt">>(
    table ?? { ccnl, source: "", mensilita: 13, rows: levels.map((level) => ({ level, monthly: [] })), source_kind: "manuale" },
  );
  const [texts, setTexts] = useState<Record<number, string>>(() => Object.fromEntries(draft.rows.map((r, i) => [i, rowText(r)])));
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const load = (next: Omit<CcnlTableDoc, "id" | "updatedAt">) => {
    setDraft(next);
    setTexts(Object.fromEntries(next.rows.map((r, i) => [i, rowText(r)])));
  };

  const extract = async () => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
      const idx = pages.trim() ? parsePages(pages, src.getPageCount()) : src.getPageIndices().slice(0, 20);
      const out = await PDFDocument.create();
      for (const p of await out.copyPages(src, idx)) out.addPage(p);
      const bytes = await out.save();
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const r = await fetch("/api/transparency/ccnl-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: btoa(bin), ccnl, levels }),
      });
      const body = (await r.json().catch(() => ({}))) as Partial<CcnlTableDoc> & { error?: string };
      if (!r.ok || !body.rows) {
        setMessage(tr(ERRORS[body.error ?? "ai"] ?? ERRORS.ai));
        return;
      }
      load({
        ...draft,
        source: `${file.name}${pages.trim() ? `, pag. ${pages.trim()}` : ""}`,
        validFrom: body.validFrom,
        expires: body.expires,
        mensilita: body.mensilita ?? draft.mensilita,
        classes: body.classes,
        rows: body.rows,
        note: body.note || undefined,
        source_kind: "pdf",
      });
      setMessage(tr("Tabella letta dal PDF: controlla livelli e importi prima di salvare."));
    } catch {
      setMessage(tr(ERRORS.body));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const rows = draft.rows
      .map((r, i) => (r.annual != null ? r : { level: r.level, monthly: parseValues(texts[i] ?? "") }))
      .filter((r) => r.level.trim() && (r.annual != null || (r.monthly?.length ?? 0) > 0));
    onSave({ ...draft, rows, id: table?.id ?? `ccnl-${roleId(ccnl)}`, ccnl, updatedAt: new Date().toISOString(), updatedBy: email });
  };

  return (
    <Modal
      title={tr("Minimi CCNL · {0}", [ccnl])}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <GhostButton onClick={onClose}>{tr("Annulla")}</GhostButton>
          <PrimaryButton onClick={save}>{tr("Salva tabella")}</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {library.length > 0 && (
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
              <BookOpen className="h-3.5 w-3.5" /> {tr("Libreria Spark")}
            </p>
            <div className="flex flex-wrap gap-2">
              {library.map((t) => (
                <GhostButton
                  key={t.key}
                  onClick={() => {
                    load({ ccnl, source: t.source, validFrom: t.validFrom, expires: t.expires, mensilita: t.mensilita, classes: t.classes, rows: t.rows, note: t.note, source_kind: "libreria" });
                    setMessage(tr("Tabella della libreria caricata: controlla e salva."));
                  }}
                >
                  {t.label}
                </GhostButton>
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            <FileUp className="h-3.5 w-3.5" /> {tr("Dal PDF dell'accordo")}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[12px]" />
            <label className="w-40">
              <span className="mb-1 block text-[11px] text-muted">{tr("Pagine delle tabelle")}</span>
              <input className={inputCls} value={pages} onChange={(e) => setPages(e.target.value)} placeholder={tr("es. 63, 65")} />
            </label>
            <PrimaryButton disabled={!file || busy} onClick={() => void extract()} className="flex items-center gap-1.5">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {tr("Leggi tabella")}
            </PrimaryButton>
          </div>
        </section>
        {message && <div className="rounded-lg bg-canvas px-3 py-2 text-[12.5px]">{message}</div>}

        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Fonte">
            <input className={inputCls} value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })} placeholder={tr("es. Rinnovo 16/11/2022, Allegato 2/B")} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Decorrenza">
              <input type="date" className={inputCls} value={draft.validFrom ?? ""} onChange={(e) => setDraft({ ...draft, validFrom: e.target.value || undefined })} />
            </Field>
            <Field label="Scadenza">
              <input type="date" className={inputCls} value={draft.expires ?? ""} onChange={(e) => setDraft({ ...draft, expires: e.target.value || undefined })} />
            </Field>
            <Field label="Mensilità">
              <input type="number" min={12} max={16} className={inputCls} value={draft.mensilita} onChange={(e) => setDraft({ ...draft, mensilita: Math.min(16, Math.max(12, Number(e.target.value) || 13)) })} />
            </Field>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2">
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={!!draft.classes} onChange={(e) => setDraft({ ...draft, classes: e.target.checked ? { first: 4, step: 3 } : undefined })} />
              {tr("Classi di anzianità")}
            </label>
            {draft.classes && (
              <>
                <label className="w-36">
                  <span className="mb-1 block text-[11px] text-muted">{tr("Anni della prima classe")}</span>
                  <input type="number" min={1} className={inputCls} value={draft.classes.first} onChange={(e) => setDraft({ ...draft, classes: { ...draft.classes!, first: Math.max(1, Number(e.target.value) || 1) } })} />
                </label>
                <label className="w-36">
                  <span className="mb-1 block text-[11px] text-muted">{tr("Anni delle successive")}</span>
                  <input type="number" min={1} className={inputCls} value={draft.classes.step} onChange={(e) => setDraft({ ...draft, classes: { ...draft.classes!, step: Math.max(1, Number(e.target.value) || 1) } })} />
                </label>
              </>
            )}
          </div>
        </section>

        <section>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
            {draft.classes ? tr("Minimi mensili per livello (un valore per classe, separati da ;)") : tr("Minimi mensili per livello")}
          </p>
          <div className="space-y-1.5">
            {draft.rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[160px_1fr_140px] items-center gap-2">
                <input className={inputCls} value={r.level} onChange={(e) => setDraft({ ...draft, rows: draft.rows.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)) })} />
                {r.annual != null ? (
                  <span className="text-[12px] text-muted">{tr("Minimo annuo complessivo")}</span>
                ) : (
                  <input className={inputCls} value={texts[i] ?? ""} onChange={(e) => setTexts((t) => ({ ...t, [i]: e.target.value }))} placeholder={tr("es. 1.911,40; 1.970,85")} />
                )}
                <input
                  className={inputCls}
                  value={r.annual ?? ""}
                  onChange={(e) => {
                    const v = Number(e.target.value.replace(/\./g, "").replace(",", "."));
                    setDraft({ ...draft, rows: draft.rows.map((x, j) => (j === i ? (e.target.value.trim() && v > 0 ? { level: x.level, annual: v } : { level: x.level, monthly: [] }) : x)) });
                  }}
                  placeholder={tr("o annuo")}
                />
              </div>
            ))}
            <GhostButton onClick={() => setDraft({ ...draft, rows: [...draft.rows, { level: "", monthly: [] }] })}>{tr("+ Aggiungi livello")}</GhostButton>
          </div>
          {draft.note && <p className="mt-2 text-[12px] text-muted">{draft.note}</p>}
        </section>
      </div>
    </Modal>
  );
}

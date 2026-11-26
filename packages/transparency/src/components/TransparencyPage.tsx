"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, FolderOpen, Trash2, Upload } from "lucide-react";
import { GhostButton, Modal, PrimaryButton, Tooltip, localeTag, tr, useAccess, useCore } from "@spark/core";
import { CompensationAnalysis, type SavedJustification } from "../lib/analysis/CompensationAnalysis";
import { MAPPING_REQUIRED_ROLES, MAPPING_UI_SECTIONS, getRoleLabel, type ColumnMapping, type ColumnRole } from "../lib/columnRoles";
import { parseExcelFromFile, WorkbookParseError, type ParsedWorkbook } from "../lib/parseWorkbook";
import { checkSchema, TEA_V2_EXPECTED_HEADERS, type SchemaCheckResult } from "../lib/provaTrasparenzaAdapter";
import { usePayAnalyses } from "../store";
import { Results } from "./Results";
import { useBenchmarkRunner } from "./benchmarkRunner";
import { useBenchmarks } from "../store";

type Step =
  | { kind: "upload" }
  | { kind: "mapping"; file: ParsedWorkbook & { fileName: string }; schema: SchemaCheckResult; mapping: ColumnMapping }
  | { kind: "results"; analysis: CompensationAnalysis; fileName: string; docId?: string; name?: string; file?: ParsedWorkbook & { fileName: string }; schema?: SchemaCheckResult; mapping?: ColumnMapping };

/**
 * Trasparenza retributiva: upload the Spark payroll template, check the columns, see the gender pay
 * gaps (EU directive 2023/970) and the single employees' reports; analyses are saved in the history.
 */
export function TransparencyPage() {
  const [tab, setTab] = useState<"analisi" | "storico">("analisi");
  const [step, setStep] = useState<Step>({ kind: "upload" });
  const { analyses, save, remove } = usePayAnalyses();
  const { allowed } = useAccess();
  const { notify, viewer } = useCore();
  const canManage = allowed("transparency.manage");
  const { run: runBenchmarks } = useBenchmarkRunner();
  const { removeFor } = useBenchmarks();

  const open = (id: string) => {
    const doc = analyses.find((d) => d.id === id);
    const analysis = doc && CompensationAnalysis.fromSnapshot(doc.snapshot);
    if (!doc || !analysis) {
      notify(tr("Questa analisi è in un formato precedente: carica di nuovo il file."));
      return;
    }
    setStep({ kind: "results", analysis, fileName: doc.fileName, docId: doc.id, name: doc.name });
    setTab("analisi");
  };

  const persist = (s: Extract<Step, { kind: "results" }>, name: string, justifications: SavedJustification[]) => {
    s.analysis.justifications = justifications;
    const snapshot = s.analysis.toSnapshot();
    const id = save({
      id: s.docId,
      name: name || s.fileName,
      fileName: s.fileName,
      createdBy: viewer?.email,
      employeeCount: s.analysis.employeeCount,
      snapshot: { ...snapshot, savedName: name || s.fileName },
    });
    setStep({ ...s, docId: id, name: name || s.fileName });
    notify(s.docId ? tr("Analisi aggiornata") : tr("Analisi salvata nello storico"));
    // market benchmarks of the roles are ready by the time the Benchmarks page is opened
    if (!s.docId) void runBenchmarks(id, s.analysis.employees);
  };

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-[14px] font-semibold">{tr("Trasparenza retributiva")}</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">{tr("Divari retributivi di genere secondo la direttiva UE 2023/970")}</p>
        </div>
        <div className="ml-auto flex rounded-lg bg-canvas p-0.5 text-[12.5px] font-semibold">
          {(["analisi", "storico"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 transition-colors ${tab === t ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {t === "analisi" ? tr("Analisi") : tr("Storico ({0})", [analyses.length])}
            </button>
          ))}
        </div>
      </div>

      {tab === "storico" && (
        <History
          items={analyses.map((d) => ({ id: d.id, name: d.name, fileName: d.fileName, createdAt: d.createdAt, count: d.employeeCount }))}
          canManage={canManage}
          onOpen={open}
          onRemove={(id) => {
            remove(id);
            removeFor(id);
            if (step.kind === "results" && step.docId === id) setStep({ kind: "upload" });
            notify(tr("Analisi eliminata"));
          }}
        />
      )}

      {tab === "analisi" && step.kind === "upload" && (
        <UploadStep
          canManage={canManage}
          hasHistory={analyses.length > 0}
          onShowHistory={() => setTab("storico")}
          onLoaded={(file) => {
            const schema = checkSchema(file.headers);
            setStep({ kind: "mapping", file, schema, mapping: { ...schema.mapping } });
          }}
        />
      )}

      {tab === "analisi" && step.kind === "mapping" && (
        <MappingStep
          file={step.file}
          schema={step.schema}
          mapping={step.mapping}
          onMapping={(mapping) => setStep({ ...step, mapping })}
          onBack={() => setStep({ kind: "upload" })}
          onConfirm={() => {
            const analysis = CompensationAnalysis.fromWorkbook(step.file.rows, step.file.headers, step.mapping);
            if (!analysis.employeeCount) {
              notify(tr("Nessun dipendente valido: controlla l'abbinamento delle colonne."));
              return;
            }
            setStep({ kind: "results", analysis, fileName: step.file.fileName, file: step.file, schema: step.schema, mapping: step.mapping });
          }}
        />
      )}

      {tab === "analisi" && step.kind === "results" && (
        <Results
          key={step.docId ?? step.fileName}
          analysis={step.analysis}
          fileName={step.fileName}
          savedName={step.name}
          saved={!!step.docId}
          canManage={canManage}
          onSave={(name, justifications) => persist(step, name, justifications)}
          onNew={() => setStep({ kind: "upload" })}
          onEditMapping={step.file && step.schema && step.mapping ? () => setStep({ kind: "mapping", file: step.file!, schema: step.schema!, mapping: step.mapping! }) : undefined}
        />
      )}
    </div>
  );
}

/** Empty payroll template with the expected columns (the Spark / TEA layout). */
async function downloadTemplate() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Dipendenti");
  ws.addRow(TEA_V2_EXPECTED_HEADERS);
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c) => (c.width = 22));
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "tracciato-trasparenza-retributiva.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

function UploadStep({ canManage, hasHistory, onShowHistory, onLoaded }: { canManage: boolean; hasHistory: boolean; onShowHistory: () => void; onLoaded: (f: ParsedWorkbook & { fileName: string }) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const load = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseExcelFromFile(file);
      if (!parsed.headers.length || !parsed.rows.length) setError(tr("Il file non contiene righe di dati."));
      else if (!checkSchema(parsed.headers).tea) setError(tr("Il file non segue il tracciato di Spark: scarica il tracciato vuoto e copia lì i dati."));
      else onLoaded({ ...parsed, fileName: file.name });
    } catch (e) {
      setError(e instanceof WorkbookParseError && e.code === "empty" ? tr("Il file non contiene righe di dati.") : tr("Impossibile leggere il file."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  if (!canManage) {
    return (
      <div className="card px-5 py-10 text-center text-[12.5px] text-muted">
        {hasHistory ? (
          <button type="button" onClick={onShowHistory} className="font-semibold text-brand hover:underline">
            {tr("Apri un'analisi dallo storico")}
          </button>
        ) : (
          tr("Nessuna analisi disponibile.")
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3.5 lg:grid-cols-[1fr_300px]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void load(e.dataTransfer.files[0]);
        }}
        className={`card flex flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-12 text-center transition-colors ${drag ? "border-brand bg-brand-soft/40" : "border-transparent"}`}
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-brand">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[14px] font-semibold">{tr("Carica il tracciato retributivo")}</p>
          <p className="mt-1 text-[12.5px] text-muted">{tr("File .xlsx o .csv, una riga per dipendente. Trascinalo qui o sceglilo dal computer.")}</p>
        </div>
        <input ref={input} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => void load(e.target.files?.[0])} />
        <PrimaryButton disabled={busy} onClick={() => input.current?.click()} className="flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5" strokeWidth={3} /> {busy ? tr("Lettura file…") : tr("Scegli file")}
        </PrimaryButton>
        {error && <p className="max-w-md text-[12.5px] font-semibold text-red-600">{error}</p>}
        <p className="text-[11.5px] text-faint">{tr("Il file viene letto nel browser: nel database si salvano solo i dati dell'analisi, quando scegli di salvarla.")}</p>
      </div>
      <div className="card space-y-2.5 p-4 text-[12.5px]">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Come preparare il file")}</p>
        <ol className="list-decimal space-y-1.5 pl-4 text-muted">
          <li>{tr("Scarica il tracciato vuoto.")}</li>
          <li>{tr("Copia una riga per dipendente: sesso, livello CCNL, RAL e le altre voci retributive.")}</li>
          <li>{tr("Le voci fisse sono mensili, la RAL e le voci variabili sono annue.")}</li>
        </ol>
        <GhostButton onClick={() => void downloadTemplate()} className="!px-0 flex items-center gap-1.5 !text-brand hover:!bg-transparent">
          <Download className="h-3.5 w-3.5" /> {tr("Scarica il tracciato vuoto")}
        </GhostButton>
      </div>
    </div>
  );
}

function MappingStep({
  file,
  schema,
  mapping,
  onMapping,
  onBack,
  onConfirm,
}: {
  file: ParsedWorkbook & { fileName: string };
  schema: SchemaCheckResult;
  mapping: ColumnMapping;
  onMapping: (m: ColumnMapping) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const fields = MAPPING_UI_SECTIONS.flatMap((s) => s.fields);
  const missing = MAPPING_REQUIRED_ROLES.filter((r) => mapping[r] == null);
  const [showAll, setShowAll] = useState(missing.length > 0);
  const shown = showAll ? fields : fields.filter((f) => mapping[f.role] == null);
  const headers = useMemo(() => file.headers.map((h, i) => ({ i, label: String(h ?? "").trim() || tr("Colonna {0}", [i + 1]) })), [file.headers]);
  const set = (role: ColumnRole, v: string) => {
    const next = { ...mapping };
    if (v === "") delete next[role];
    else next[role] = Number(v);
    onMapping(next);
  };

  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3">
        <FileSpreadsheet className="h-5 w-5 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{file.fileName}</p>
          <p className="text-[12px] text-muted">
            {tr("{0} righe · {1} colonne riconosciute su {2}", [file.rows.length, schema.matched.length, headers.filter((h) => String(file.headers[h.i] ?? "").trim()).length])}
          </p>
        </div>
        <GhostButton onClick={onBack} className="flex items-center gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> {tr("Scegli un altro file")}
        </GhostButton>
        <PrimaryButton onClick={onConfirm}>{tr("Esegui analisi")}</PrimaryButton>
      </div>

      {missing.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
          <span className="font-semibold">{tr("Colonne mancanti")}:</span> {missing.map((r) => tr(getRoleLabel(r))).join(", ")}.{" "}
          {tr("L'analisi si può fare lo stesso: le voci mancanti contano zero.")}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12.5px] font-semibold text-emerald-900">
          {tr("Tracciato riconosciuto: tutte le colonne obbligatorie sono abbinate.")}
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{tr("Abbinamento colonne")}</p>
          <button type="button" onClick={() => setShowAll((v) => !v)} className="text-[12px] font-semibold text-brand hover:underline">
            {showAll ? tr("Mostra solo i non abbinati") : tr("Mostra tutti i campi")}
          </button>
        </div>
        {shown.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12.5px] text-muted">{tr("Tutti i campi sono abbinati a una colonna.")}</p>
        ) : (
          <table className="w-full min-w-[520px] border-collapse text-left">
            <tbody>
              {shown.map((f) => (
                <tr key={f.role} className="border-b border-line last:border-0">
                  <td className="w-1/2 px-4 py-1.5 text-[12.5px]">
                    {tr(getRoleLabel(f.role))}
                    {f.badge === "required" && <span className="ml-2 text-[11px] font-semibold text-red-600">{tr("obbligatorio")}</span>}
                    {f.badge === "recommended" && <span className="ml-2 text-[11px] font-semibold text-amber-700">{tr("consigliato")}</span>}
                  </td>
                  <td className="px-4 py-1.5">
                    <select
                      value={mapping[f.role] ?? ""}
                      onChange={(e) => set(f.role, e.target.value)}
                      className="w-full rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-brand"
                    >
                      <option value="">{tr("— Non abbinato —")}</option>
                      {headers.map((h) => (
                        <option key={h.i} value={h.i}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function History({
  items,
  canManage,
  onOpen,
  onRemove,
}: {
  items: { id: string; name: string; fileName: string; createdAt: string; count: number }[];
  canManage: boolean;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  if (!items.length) return <div className="card px-5 py-10 text-center text-[12.5px] text-muted">{tr("Nessuna analisi salvata: dopo aver caricato un file usa «Salva nello storico».")}</div>;
  const target = items.find((i) => i.id === deleting);
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[11px] font-bold uppercase text-[#9aa2b1]">
            <th className="px-3 py-2.5 pl-4">{tr("Analisi")}</th>
            <th className="px-3 py-2.5">{tr("File")}</th>
            <th className="px-3 py-2.5">{tr("Data")}</th>
            <th className="px-3 py-2.5 text-right">{tr("Dipendenti")}</th>
            <th className="w-[80px] px-3 py-2.5 pr-4" />
          </tr>
        </thead>
        <tbody>
          {items.map((d) => (
            <tr key={d.id} className="border-b border-line last:border-0 hover:bg-[#f8fafd]">
              <td className="px-3 py-[9px] pl-4">
                <button type="button" onClick={() => onOpen(d.id)} className="text-left text-[13px] font-semibold hover:text-brand">
                  {d.name}
                </button>
              </td>
              <td className="px-3 py-[9px] text-[12.5px] text-muted">{d.fileName}</td>
              <td className="px-3 py-[9px] text-[12.5px] text-muted">{new Date(d.createdAt).toLocaleDateString(localeTag())}</td>
              <td className="px-3 py-[9px] text-right text-[12.5px] font-semibold tabular-nums">{d.count}</td>
              <td className="px-3 py-[5px] pr-4">
                <div className="flex items-center justify-end gap-0.5">
                  <Tooltip label={tr("Apri")}>
                    <button type="button" aria-label={tr("Apri {0}", [d.name])} onClick={() => onOpen(d.id)} className="grid h-7 w-7 place-items-center rounded-md text-[#6c7486] hover:bg-brand-soft hover:text-brand">
                      <FolderOpen className="h-4 w-4" strokeWidth={2.2} />
                    </button>
                  </Tooltip>
                  {canManage && (
                    <Tooltip label={tr("Elimina")}>
                      <button type="button" aria-label={tr("Elimina {0}", [d.name])} onClick={() => setDeleting(d.id)} className="grid h-7 w-7 place-items-center rounded-md text-[#6c7486] hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                    </Tooltip>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {target && (
        <Modal
          title="Eliminare l'analisi?"
          onClose={() => setDeleting(null)}
          width="max-w-md"
          footer={
            <>
              <GhostButton onClick={() => setDeleting(null)}>{tr("Annulla")}</GhostButton>
              <PrimaryButton
                className="!bg-none !bg-red-600 !shadow-none"
                onClick={() => {
                  onRemove(target.id);
                  setDeleting(null);
                }}
              >
                {tr("Elimina")}
              </PrimaryButton>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">{target.name}</span> {tr("e i dati dei suoi dipendenti vengono eliminati dallo storico.")}
          </p>
        </Modal>
      )}
    </div>
  );
}

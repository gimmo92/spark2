"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, GhostButton, PrimaryButton, inputCls, tr, useAccess, useCore } from "@spark/core";
import { CompensationAnalysis } from "../lib/analysis/CompensationAnalysis";
import type { ColumnMapping } from "../lib/columnRoles";
import type { ParsedWorkbook } from "../lib/parseWorkbook";
import { checkSchema, type SchemaCheckResult } from "../lib/provaTrasparenzaAdapter";
import { useBenchmarks, usePayAnalyses } from "../store";
import { useBenchmarkRunner } from "./benchmarkRunner";
import { History, MappingStep, UploadStep } from "./dataSteps";

type Step =
  | { kind: "upload" }
  | { kind: "mapping"; file: ParsedWorkbook & { fileName: string }; schema: SchemaCheckResult; mapping: ColumnMapping }
  | { kind: "name"; analysis: CompensationAnalysis; fileName: string; name: string };

/**
 * Compensation → Caricamento dati: upload the Spark payroll template, check the columns, name and
 * save it. Saved data feed every Compensation page (pay transparency, job grading, benchmarks); the
 * market benchmarks of the roles start in the background on save.
 */
export function DataUploadPage({ transparencyHref = "/trasparenza" }: { transparencyHref?: string }) {
  const [step, setStep] = useState<Step>({ kind: "upload" });
  const { analyses, save, remove } = usePayAnalyses();
  const { removeFor } = useBenchmarks();
  const { run: runBenchmarks } = useBenchmarkRunner();
  const { allowed } = useAccess();
  const { notify, viewer } = useCore();
  const router = useRouter();
  const canManage = allowed("transparency.manage");
  const openIn = (id: string) => router.push(`${transparencyHref}?analisi=${encodeURIComponent(id)}`);

  const persist = (s: Extract<Step, { kind: "name" }>) => {
    const name = s.name.trim() || s.fileName;
    const id = save({
      name,
      fileName: s.fileName,
      createdBy: viewer?.email,
      employeeCount: s.analysis.employeeCount,
      snapshot: { ...s.analysis.toSnapshot(), savedName: name },
    });
    notify(tr("Dati caricati: {0} dipendenti", [s.analysis.employeeCount]));
    // market benchmarks of the roles are ready by the time the Benchmarks page is opened
    void runBenchmarks(id, s.analysis.employees);
    openIn(id);
  };

  return (
    <div className="space-y-3.5">
      <div>
        <h1 className="text-[14px] font-semibold">{tr("Caricamento dati")}</h1>
      </div>

      {step.kind === "upload" && (
        <UploadStep
          canManage={canManage}
          onLoaded={(file) => {
            const schema = checkSchema(file.headers);
            setStep({ kind: "mapping", file, schema, mapping: { ...schema.mapping } });
          }}
        />
      )}

      {step.kind === "mapping" && (
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
            setStep({ kind: "name", analysis, fileName: step.file.fileName, name: step.file.fileName.replace(/\.[^.]+$/, "") });
          }}
        />
      )}

      {step.kind === "name" && (
        <form
          className="card space-y-3 px-4 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            persist(step);
          }}
        >
          <p className="text-[13px] font-semibold">{tr("{0} dipendenti letti da {1}", [step.analysis.employeeCount, step.fileName])}</p>
          <div className="max-w-md">
            <Field label="Nome dei dati">
              <input autoFocus className={inputCls} value={step.name} onChange={(e) => setStep({ ...step, name: e.target.value })} placeholder={tr("es. Retribuzioni 2026")} />
            </Field>
          </div>
          <div className="flex gap-2">
            <GhostButton onClick={() => setStep({ kind: "upload" })}>{tr("Annulla")}</GhostButton>
            <PrimaryButton type="submit">{tr("Salva e apri l'analisi")}</PrimaryButton>
          </div>
        </form>
      )}

      <div>
        <p className="mb-2 text-[13px] font-semibold">{tr("Dati caricati")}</p>
        <History
          items={analyses.map((d) => ({ id: d.id, name: d.name, fileName: d.fileName, createdAt: d.createdAt, count: d.employeeCount }))}
          canManage={canManage}
          onOpen={openIn}
          onRemove={(id) => {
            remove(id);
            removeFor(id);
            notify(tr("Dati eliminati"));
          }}
        />
      </div>
    </div>
  );
}

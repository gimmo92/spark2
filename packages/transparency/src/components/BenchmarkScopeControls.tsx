"use client";

import { inputCls, tr } from "@spark/core";
import { AREAS, REGIONS, SENIORITIES, SIZES, cleanScope, type BenchmarkScope } from "../lib/benchmark";

const selectCls = "rounded-lg border border-[#dfe3ea] bg-white px-2 py-1.5 text-[12.5px] outline-none focus:border-brand disabled:bg-canvas";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted";

/** Scope of a benchmark comparison: geography (down to region and city), company size, sector, seniority. */
export function BenchmarkScopeControls({ scope, onChange, sectorHint, disabled }: { scope: BenchmarkScope; onChange: (s: BenchmarkScope) => void; sectorHint?: string; disabled?: boolean }) {
  const set = (patch: Partial<BenchmarkScope>) => onChange(cleanScope({ ...scope, ...patch }));
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label>
        <span className={labelCls}>{tr("Area geografica")}</span>
        <select
          disabled={disabled}
          className={selectCls}
          value={scope.area}
          onChange={(e) => set({ area: e.target.value as BenchmarkScope["area"], region: e.target.value === "regione" ? (scope.region ?? REGIONS[0]) : undefined })}
        >
          {AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {tr(a.label)}
            </option>
          ))}
        </select>
      </label>
      {scope.area === "regione" && (
        <>
          <label>
            <span className={labelCls}>{tr("Regione")}</span>
            <select disabled={disabled} className={selectCls} value={scope.region} onChange={(e) => set({ region: e.target.value })}>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="w-44">
            <span className={labelCls}>{tr("Città (opzionale)")}</span>
            <input disabled={disabled} className={inputCls} value={scope.city ?? ""} onChange={(e) => set({ city: e.target.value })} placeholder={tr("es. Milano")} />
          </label>
        </>
      )}
      <label>
        <span className={labelCls}>{tr("Dimensione azienda")}</span>
        <select disabled={disabled} className={selectCls} value={scope.size} onChange={(e) => set({ size: e.target.value as BenchmarkScope["size"] })}>
          {SIZES.map((s) => (
            <option key={s.id} value={s.id}>
              {tr(s.label)}
            </option>
          ))}
        </select>
      </label>
      <label className="w-48">
        <span className={labelCls}>{tr("Settore")}</span>
        <input disabled={disabled} className={inputCls} value={scope.sector ?? ""} onChange={(e) => set({ sector: e.target.value })} placeholder={sectorHint ?? tr("dal profilo dei ruoli")} />
      </label>
      <label>
        <span className={labelCls}>{tr("Seniority")}</span>
        <select disabled={disabled} className={selectCls} value={scope.seniority} onChange={(e) => set({ seniority: e.target.value as BenchmarkScope["seniority"] })}>
          {SENIORITIES.map((s) => (
            <option key={s.id} value={s.id}>
              {tr(s.label)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

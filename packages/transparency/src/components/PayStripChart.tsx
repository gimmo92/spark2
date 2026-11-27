"use client";

import { useState } from "react";
import { tr } from "@spark/core";
import { eur } from "./format";

/** Categorical slots 1–2 of the validated reference palette (blue / orange, CVD-safe on white). */
export const GENDER_COLOR = { M: "#257de0", F: "#f47230" } as const;

export interface StripPoint {
  key: string | number;
  value: number;
  gender: "M" | "F";
  label: string;
  /** The person the page is about: drawn larger with a dark ring. */
  highlight?: boolean;
}

const W = 640;
const PAD_L = 72;
const PAD_R = 16;
const ROW = 46;

function niceStep(span: number, target = 5) {
  const raw = Math.max(1, span) / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
}

/**
 * Pay strip chart: one dot per person on a euro axis, one row per gender, with optional reference
 * lines (mean, median) and a shaded band (e.g. market Q1–Q3). Hover shows the person.
 */
export function PayStripChart({
  points,
  lines = [],
  band,
  ariaLabel,
}: {
  points: StripPoint[];
  lines?: { value: number; label: string; dashed?: boolean }[];
  band?: { from: number; to: number; label: string };
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<StripPoint | null>(null);
  const values = [...points.map((p) => p.value), ...lines.map((l) => l.value), ...(band ? [band.from, band.to] : [])];
  if (!values.length) return null;
  const step = niceStep(Math.max(...values) - Math.min(...values));
  const lo = Math.floor(Math.min(...values) / step) * step;
  const hi = Math.ceil(Math.max(...values) / step) * step || lo + step;
  const x = (v: number) => PAD_L + ((v - lo) / (hi - lo || 1)) * (W - PAD_L - PAD_R);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-6; t += step) ticks.push(t);
  const groups = (["M", "F"] as const).filter((g) => points.some((p) => p.gender === g));
  const top = 24;
  const H = top + groups.length * ROW + 24;
  const rowY = (i: number) => top + i * ROW + ROW / 2;
  const fmt = (v: number) => (step >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));

  return (
    <div className="relative">
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
        {groups.map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: GENDER_COLOR[g] }} />
            {g === "M" ? tr("Uomini") : tr("Donne")}
          </span>
        ))}
        {points.some((p) => p.highlight) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-ink bg-white" />
            {tr("Il dipendente")}
          </span>
        )}
        {band && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-5 rounded-sm bg-[#e3ecfb]" />
            {band.label}
          </span>
        )}
        {lines.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-3 w-0 border-l-2 ${l.dashed ? "border-dashed border-[#666666]" : "border-ink"}`} />
            {l.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top - 6} y2={H - 20} stroke="#eef0f4" />
            <text x={x(t)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="#8a93a3">
              {fmt(t)}
            </text>
          </g>
        ))}
        {band && <rect x={x(band.from)} y={top - 6} width={Math.max(2, x(band.to) - x(band.from))} height={H - top - 14} rx={4} fill="#e3ecfb" />}
        {lines.map((l) => (
          <line key={l.label} x1={x(l.value)} x2={x(l.value)} y1={top - 10} y2={H - 20} stroke={l.dashed ? "#666666" : "#191919"} strokeWidth={2} strokeDasharray={l.dashed ? "4 3" : undefined} />
        ))}
        {groups.map((g, gi) => (
          <g key={g}>
            <text x={PAD_L - 10} y={rowY(gi) + 4} textAnchor="end" fontSize="11.5" fill="#666666">
              {g === "M" ? tr("Uomini") : tr("Donne")}
            </text>
            {points
              .filter((p) => p.gender === g)
              .sort((a, b) => Number(!!a.highlight) - Number(!!b.highlight))
              .map((p, i) => (
                <circle
                  key={p.key}
                  cx={x(p.value)}
                  cy={rowY(gi) + (p.highlight ? 0 : ((i % 5) - 2) * 4)}
                  r={p.highlight ? 7 : hover?.key === p.key ? 6 : 4.5}
                  fill={GENDER_COLOR[g]}
                  stroke={p.highlight ? "#191919" : "#ffffff"}
                  strokeWidth={p.highlight ? 2.5 : 2}
                  onMouseEnter={() => setHover(p)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
          </g>
        ))}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[11.5px] text-white shadow-lg" style={{ left: `${(x(hover.value) / W) * 100}%`, top: 16 }}>
          <p className="font-semibold">{hover.label}</p>
          <p className="tabular-nums">{eur(hover.value)}</p>
        </div>
      )}
    </div>
  );
}

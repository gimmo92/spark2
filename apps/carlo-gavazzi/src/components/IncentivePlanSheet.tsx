"use client";

/**
 * Carlo Gavazzi: "Incentive Plan – Calculation" view of a scheda, laid out like the client's Excel bonus sheets
 * (one column block per objective: Objective / % of target / Bonus / payout %, levels around the Targets row,
 * Actual row, "Paid out" total). Labels stay in English as in their sheets.
 * The target bonus (amount + currency) is not part of the MBO model yet: it is kept per scheda in the
 * settings doc "cgBonus" (writable by admins).
 */
import { Fragment } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { GhostButton, Tooltip, fullName, useAccess, useOrg, useSettings } from "@spark/core";
import {
  activityDef,
  activityValue,
  activityWeight,
  cycleLabel,
  formatValue,
  globalGateMet,
  itemDef,
  payoutFor,
  thresholdMet,
  typeOf,
  useMbo,
  type Level,
  type ObjectiveDef,
  type SchedaItem,
} from "@spark/mbo";

interface BonusDoc {
  targets: Record<string, { amount?: number; currency?: string }>;
}

const NAVY = "bg-[#1f3864] text-white";
const BAND = "bg-[#dbe5f1] font-bold";
const BLUE = "text-[#1d1dd9]";

const nf = (n: number, digits = 0) => n.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (n: number, digits = 0) => `${nf(n, digits)}%`;

/** "2026" → "FY 2026/27" (their fiscal year runs April–March); other cycles keep their label. */
const fyLabel = (cycle: string) => (/^\d{4}$/.test(cycle) ? `FY ${cycle}/${String((Number(cycle) + 1) % 100).padStart(2, "0")}` : cycleLabel(cycle));

/** The level paying 100% (or the closest one): the "Targets" row. */
function targetIndex(levels: Level[]) {
  if (!levels.length) return -1;
  let best = 0;
  levels.forEach((l, i) => {
    if (Math.abs(l.payout - 100) < Math.abs(levels[best].payout - 100)) best = i;
  });
  return best;
}

/** Objective value as in their sheets: plain numbers with decimals, other types in words. */
function objValue(def: ObjectiveDef, v: number) {
  if (typeOf(def) === "quantitativo") return nf(v, Math.abs(v) < 100 && !Number.isInteger(v) ? 2 : Number.isInteger(v) ? 0 : 2);
  return formatValue(def, v);
}

interface Cell {
  obj: string;
  ofTarget?: string;
  bonus?: string;
  payout?: string;
}

interface Column {
  item: SchedaItem;
  def: ObjectiveDef;
  below: Cell[];
  target?: Cell;
  above: Cell[];
  actual: Cell;
  targetValue?: string;
  actualValue?: string;
  payout: number;
  amount?: number;
}

export function IncentivePlanSheet() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { schede, objectives, users, hydrated, globalGate, canEditScheda } = useMbo();
  const { buForTeam } = useOrg();
  const { allowed } = useAccess();
  const [bonusDoc, patchBonus] = useSettings<BonusDoc>("cgBonus", { targets: {} });
  const s = schede.find((x) => x.id === id);

  if (!hydrated) return <div className="card h-40 animate-pulse" />;
  if (!s)
    return (
      <div className="card px-5 py-10 text-center text-[13px] text-muted">
        Scheda non trovata.{" "}
        <Link href="/mbo/schede" className="font-semibold text-brand hover:underline">
          Torna alle schede
        </Link>
      </div>
    );

  const people = s.assigneeIds.map((uid) => users.find((u) => u.id === uid)).filter((u) => !!u);
  const first = people[0];
  const bu = first?.team ? buForTeam(first.team) : undefined;
  const bonus = bonusDoc.targets[s.id] ?? {};
  const amount = bonus.amount;
  const currency = bonus.currency || "CHF";
  const canSetBonus = allowed("mbo.settings.manage");
  const gateOk = globalGateMet(objectives, globalGate) && thresholdMet(objectives, s);
  const money = (weight: number, payout: number) => (amount != null ? nf((amount * weight * payout) / 10000, 1) : "—");
  const setBonus = (p: { amount?: number; currency?: string }) => patchBonus({ targets: { ...bonusDoc.targets, [s.id]: { ...bonus, ...p } } });

  const columns: Column[] = s.items.flatMap((item): Column[] => {
    const def = itemDef(objectives, item);
    if (!def) return [];
    const payout = gateOk ? payoutFor(def, item.actual) : 0;
    const w = item.weight;

    // project with levels per activity: one row per activity under the Targets row
    if (typeOf(def) === "progetto" && def.activityLevels) {
      const m = { done: item.done, values: item.values };
      return [
        {
          item,
          def,
          below: [],
          target: { obj: "100,0", ofTarget: "100,0%", bonus: money(w, 100), payout: "100%" },
          above: (def.activities ?? []).map((a) => {
            const ad = activityDef(def, a);
            const p = payoutFor(ad, activityValue(a, m));
            return { obj: a.title, ofTarget: pct(activityWeight(def, a), 1), bonus: money((w * activityWeight(def, a)) / 100, p), payout: pct(p) };
          }),
          actual: item.actual != null ? { obj: nf(item.actual, 1), bonus: money(w, payout), payout: pct(payout) } : { obj: "-", bonus: "-" },
          targetValue: "Enclosed list",
          actualValue: item.actual != null ? pct(item.actual, 1) : undefined,
          payout,
          amount: amount != null ? (amount * w * payout) / 10000 : undefined,
        },
      ];
    }

    const levels = [...def.levels].sort((a, b) => (typeOf(def) === "data" ? b.target - a.target : a.target - b.target));
    const ti = targetIndex(levels);
    const tv = ti >= 0 ? levels[ti].target : undefined;
    const ofTarget = (v: number) => (tv && typeOf(def) !== "data" && typeOf(def) !== "onoff" ? pct((v / tv) * 100, 1) : undefined);
    const cell = (l: Level): Cell => ({ obj: objValue(def, l.target), ofTarget: ofTarget(l.target), bonus: money(w, l.payout), payout: pct(l.payout) });
    return [
      {
        item,
        def,
        below: levels.slice(0, Math.max(ti, 0)).map(cell),
        target: ti >= 0 ? cell(levels[ti]) : undefined,
        above: levels.slice(ti + 1).map(cell),
        actual:
          item.actual != null
            ? { obj: objValue(def, item.actual), ofTarget: ofTarget(item.actual), bonus: money(w, payout), payout: pct(payout) }
            : { obj: "-", bonus: "-" },
        targetValue: tv != null ? objValue(def, tv) : undefined,
        actualValue: item.actual != null ? objValue(def, item.actual) : undefined,
        payout,
        amount: amount != null ? (amount * w * payout) / 10000 : undefined,
      },
    ];
  });

  const maxBelow = Math.max(0, ...columns.map((c) => c.below.length));
  const maxAbove = Math.max(0, ...columns.map((c) => c.above.length));
  const totalPayout = columns.reduce((sum, c) => sum + (c.item.weight * c.payout) / 100, 0);
  const totalAmount = amount != null ? (amount * totalPayout) / 100 : undefined;
  const measured = columns.some((c) => c.item.actual != null);

  const td = "px-2 py-[3px] text-right tabular-nums whitespace-nowrap";
  const small = "text-[10.5px]";
  const blockStart = "border-l-2 border-[#1f3864]";
  const cells = (c: Cell | undefined, band = false) => (
    <>
      <td className={`${td} ${blockStart} ${c && c.ofTarget === undefined && c.obj.length > 12 ? "text-left" : ""}`}>{c?.obj ?? ""}</td>
      <td className={`${td} ${band ? "" : small}`}>{c?.ofTarget ?? ""}</td>
      <td className={td}>{c?.bonus ?? ""}</td>
      <td className={`${td} ${band ? "" : small}`}>{c?.payout ?? ""}</td>
    </>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/mbo/schede" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> Schede obiettivo
        </Link>
        <div className="flex items-center gap-1.5">
          <Tooltip label="Stampa o salva in PDF">
            <button
              type="button"
              aria-label="Stampa"
              onClick={() => window.print()}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
            >
              <Printer className="h-4 w-4" />
            </button>
          </Tooltip>
          {canEditScheda(s) && s.status !== "archiviata" && (
            <GhostButton className="inline-flex items-center gap-1.5" onClick={() => router.push(`/mbo/schede/${s.id}`)}>
              <Pencil className="h-3.5 w-3.5" /> Modifica scheda
            </GhostButton>
          )}
        </div>
      </div>

      <div className="card overflow-hidden p-5 text-[12.5px] text-black">
        {/* heading + individual performance */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-[20px] font-extrabold leading-tight">
              {bu ? `${bu} ` : ""}Incentive Plan {fyLabel(s.cycle)} - Calculation
            </h1>
            <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-4 gap-y-1.5 text-[13.5px] font-bold">
              <dt>Company:</dt>
              <dd className={BLUE}>{first?.company ?? "—"}</dd>
              <dt>Name:</dt>
              <dd className={BLUE}>{people.length ? people.map(fullName).join(", ") : "—"}</dd>
              <dt>Currency:</dt>
              <dd className={`${BLUE} flex items-center gap-1.5`}>
                {canSetBonus ? (
                  <input
                    className="h-6 w-14 rounded border border-[#c9d3e3] px-1.5 text-[12.5px] font-bold uppercase outline-none focus:border-brand print:border-0"
                    value={currency}
                    maxLength={3}
                    onChange={(e) => setBonus({ currency: e.target.value.toUpperCase() })}
                    aria-label="Valuta del bonus"
                  />
                ) : (
                  currency
                )}
                <span>(for bonus)</span>
              </dd>
              <dt>Target bonus:</dt>
              <dd className={`${BLUE} flex items-center gap-1.5`}>
                {canSetBonus ? (
                  <input
                    type="number"
                    min={0}
                    className="h-6 w-28 rounded border border-[#c9d3e3] px-1.5 text-right text-[12.5px] font-bold tabular-nums outline-none focus:border-brand print:border-0"
                    value={amount ?? ""}
                    placeholder="importo"
                    onChange={(e) => setBonus({ amount: e.target.value === "" ? undefined : Number(e.target.value) })}
                    aria-label="Bonus target"
                  />
                ) : amount != null ? (
                  nf(amount, 1)
                ) : (
                  "—"
                )}
                <span>{currency} at 100%</span>
              </dd>
            </dl>
          </div>

          <table className="border-2 border-black text-[12.5px]">
            <thead>
              <tr className={NAVY}>
                <th className="px-2.5 py-1 text-left font-bold">Individual performance</th>
                <th className="border-l border-white/40 px-2.5 py-1 font-bold">Weight</th>
                <th className="border-l border-white/40 px-2.5 py-1 font-bold">Targets</th>
                <th className="border-l border-white/40 px-2.5 py-1 font-bold">Actual</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.item.id} className="border-t border-[#bfbfbf]">
                  <td className="max-w-[240px] truncate px-2.5 py-0.5 font-bold">{c.def.name}</td>
                  <td className="border-l border-[#bfbfbf] px-2.5 py-0.5 text-right tabular-nums">{pct(c.item.weight, 1)}</td>
                  <td
                    className={`border-l border-[#bfbfbf] px-2.5 py-0.5 text-right tabular-nums ${c.targetValue === "Enclosed list" ? `${BLUE} text-center font-bold` : ""}`}
                  >
                    {c.targetValue ?? "—"}
                  </td>
                  <td className="border-l border-[#bfbfbf] px-2.5 py-0.5 text-right font-bold tabular-nums text-[#e00000]">{c.actualValue ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* calculation grid */}
        {columns.length === 0 ? (
          <p className="mt-6 text-center text-[12.5px] text-muted">La scheda non ha ancora obiettivi.</p>
        ) : (
          <div className="thin-scroll mt-6 overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-[12px]">
              <thead>
                <tr className={NAVY}>
                  <th className="w-[110px] px-2 py-2 text-center text-[13px] font-bold leading-tight">
                    Individual
                    <br />
                    bonus
                  </th>
                  {columns.map((c) => (
                    <th key={c.item.id} colSpan={4} className={`${blockStart} border-white/40 px-3 py-1.5 text-center text-[13px] font-bold leading-tight`}>
                      {pct(c.item.weight, 1)}
                      <br />
                      <span className="block max-w-[340px] truncate">{c.def.name}</span>
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-black text-[10.5px] font-semibold">
                  <th />
                  {columns.map((c) => (
                    <SubHeader key={c.item.id} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxBelow }, (_, r) => (
                  <tr key={`b${r}`}>
                    <td />
                    {columns.map((c) => {
                      const k = r - (maxBelow - c.below.length);
                      return <Fragment key={c.item.id}>{cells(k >= 0 ? c.below[k] : undefined)}</Fragment>;
                    })}
                  </tr>
                ))}
                <tr className={`${BAND} border-y border-black`}>
                  <td className="px-2 py-1 text-center">Targets</td>
                  {columns.map((c) => (
                    <Fragment key={c.item.id}>{cells(c.target, true)}</Fragment>
                  ))}
                </tr>
                {Array.from({ length: maxAbove }, (_, r) => (
                  <tr key={`a${r}`}>
                    <td />
                    {columns.map((c) => (
                      <Fragment key={c.item.id}>{cells(c.above[r])}</Fragment>
                    ))}
                  </tr>
                ))}
                <tr className="h-2">
                  <td colSpan={1 + columns.length * 4} />
                </tr>
                <tr className={`${BAND} border-y-2 border-black text-[#1f3864]`}>
                  <td className="px-2 py-1 text-center">Actual</td>
                  {columns.map((c) => (
                    <Fragment key={c.item.id}>{cells(c.actual, true)}</Fragment>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {!gateOk && <p className="mt-3 text-[12px] font-semibold text-[#e00000]">Threshold not reached: no bonus is paid out for this plan.</p>}

        <div className="mt-4 flex justify-end">
          <div className="inline-flex items-center gap-4 border-2 border-[#1f3864] px-3 py-1.5 text-[13.5px] font-bold">
            <span className={BLUE}>Paid out &gt;&gt;&gt;</span>
            <span className="tabular-nums">{measured ? pct(totalPayout, 1) : "—"}</span>
            <span className="tabular-nums">{measured && totalAmount != null ? `${nf(totalAmount, 1)} ${currency}` : "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubHeader() {
  return (
    <>
      <th className="border-l-2 border-[#1f3864] px-2 pb-0.5 pt-1.5 text-center">Objective</th>
      <th className="px-2 pb-0.5 pt-1.5 text-center">%</th>
      <th className="px-2 pb-0.5 pt-1.5 text-center">Bonus</th>
      <th className="px-2 pb-0.5 pt-1.5 text-center">%</th>
    </>
  );
}

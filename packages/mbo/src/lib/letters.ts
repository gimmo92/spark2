/** MBO variables for letters (Azienda → Gestione Lettere): the person's scheda, objectives and payout. */
import type { LetterContext, LetterSource, LetterValue } from "@spark/core";
import {
  cycleLabel,
  formatValue,
  hasActuals,
  itemDef,
  levelsText,
  payoutFor,
  schedaScore,
  statusLabel,
  typeLabel,
  type GlobalGate,
  type ObjectiveDef,
  type Scheda,
} from "./mbo";

const G = "MBO";

/** The scheda a letter is about: the person's most recent one that isn't archived. */
export function schedaFor(ctx: LetterContext): Scheda | undefined {
  const mine = ((ctx.data.schede ?? []) as Scheda[]).filter((s) => s.assigneeIds.includes(ctx.user.id));
  const pool = mine.filter((s) => s.status !== "archiviata");
  return (pool.length ? pool : mine).sort((a, b) => b.cycle.localeCompare(a.cycle) || b.updatedAt.localeCompare(a.updatedAt))[0];
}

export const mboLetters: LetterSource = {
  variables: [
    { key: "scheda", label: "Nome scheda", group: G },
    { key: "anno", label: "Anno / periodo", group: G },
    { key: "stato_scheda", label: "Stato scheda", group: G },
    { key: "numero_obiettivi", label: "Numero obiettivi", group: G },
    { key: "soglia", label: "Obiettivo soglia", group: G },
    { key: "payout", label: "Payout complessivo", group: G },
    { key: "tabella_obiettivi", label: "Tabella obiettivi", group: G, table: true },
    { key: "tabella_consuntivo", label: "Tabella consuntivo", group: G, table: true },
  ],
  values: (ctx) => {
    const s = schedaFor(ctx);
    const catalog = (ctx.data.objectives ?? []) as ObjectiveDef[];
    const settings = (ctx.data.settings ?? []).find((d) => d.id === "mbo") as { globalThresholdId?: string; globalThresholdActual?: number } | undefined;
    const gate: GlobalGate = { objectiveId: settings?.globalThresholdId, actual: settings?.globalThresholdActual };
    const none = "—";
    if (!s)
      return {
        scheda: none,
        anno: none,
        stato_scheda: none,
        numero_obiettivi: "0",
        soglia: none,
        payout: none,
        tabella_obiettivi: { head: ["Obiettivo", "Peso", "Livelli"], rows: [["Nessuna scheda obiettivo", "", ""]] },
        tabella_consuntivo: { head: ["Obiettivo", "Peso", "Consuntivo", "Payout"], rows: [["Nessuna scheda obiettivo", "", "", ""]] },
      };

    const items = s.items.flatMap((it) => {
      const def = itemDef(catalog, it);
      return def ? [{ it, def }] : [];
    });
    const threshold = s.threshold && catalog.find((o) => o.id === s.threshold!.objectiveId);
    const out: Record<string, LetterValue> = {
      scheda: s.name,
      anno: cycleLabel(s.cycle),
      stato_scheda: statusLabel(s.status),
      numero_obiettivi: String(items.length),
      soglia: threshold ? `${threshold.name} (almeno ${formatValue(threshold, threshold.levels[0].target)})` : "Nessuna",
      payout: hasActuals(s) ? `${schedaScore(catalog, s, gate)}%` : "da consuntivare",
      tabella_obiettivi: {
        head: ["Obiettivo", "Tipo", "Peso", "Livelli target → payout"],
        widths: [4, 1.6, 0.8, 4],
        rows: items.map(({ it, def }) => [def.name, typeLabel(def), `${it.weight}%`, levelsText(def)]),
      },
      tabella_consuntivo: {
        head: ["Obiettivo", "Peso", "Consuntivo", "Payout"],
        widths: [4.5, 0.8, 2, 1],
        rows: items.map(({ it, def }) => [
          def.name,
          `${it.weight}%`,
          it.actual != null ? formatValue(def, it.actual) : none,
          it.actual != null ? `${payoutFor(def, it.actual)}%` : none,
        ]),
      },
    };
    return out;
  },
};

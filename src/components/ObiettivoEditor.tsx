"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { CATEGORIES, schedeUsing, type ObjectiveDef } from "@/lib/mbo";
import { useStore } from "@/lib/store";
import { Block, CustomObjectiveEditor, SectionTitle, customError } from "./SchedaEditor";
import { GhostButton, PrimaryButton, inputCls } from "./ui";

/** Route entry: /mbo/obiettivi/[id] (edit) or /mbo/obiettivi/nuovo (create). */
export function ObiettivoEditorPage({ isNew }: { isNew?: boolean }) {
  const params = useParams<{ id?: string }>();
  const { objectives, hydrated } = useStore();
  if (!hydrated) return <div className="card h-40 animate-pulse" />;
  if (isNew) return <ObiettivoEditor key="new" />;
  const def = objectives.find((o) => o.id === params.id);
  if (!def)
    return (
      <div className="card p-10 text-center">
        <p className="text-[14px] font-semibold">Obiettivo non trovato</p>
        <Link href="/mbo/obiettivi" className="mt-2 inline-block text-[12.5px] font-semibold text-brand hover:underline">
          Torna al catalogo obiettivi
        </Link>
      </div>
    );
  return <ObiettivoEditor key={def.id} def={def} />;
}

function ObiettivoEditor({ def }: { def?: ObjectiveDef }) {
  const router = useRouter();
  const { schede, addObjective, updateObjective, notify } = useStore();
  const [draft, setDraft] = useState<ObjectiveDef>(
    def ?? {
      id: "draft",
      name: "",
      description: "",
      category: CATEGORIES[0],
      unit: "%",
      calc: "lineare",
      levels: [
        { target: 80, payout: 50 },
        { target: 100, payout: 100 },
        { target: 120, payout: 150 },
      ],
    },
  );
  const [submitted, setSubmitted] = useState(false);
  const usedIn = def ? schedeUsing(schede, def.id).length : 0;

  const error = customError(draft);
  const patch = (p: Partial<ObjectiveDef>) => setDraft((d) => ({ ...d, ...p }));

  const save = () => {
    setSubmitted(true);
    if (error) {
      notify("Controlla i campi evidenziati");
      return;
    }
    const data = {
      name: draft.name.trim(),
      description: draft.description?.trim() ?? "",
      category: draft.category,
      unit: draft.unit.trim(),
      calc: draft.calc,
      levels: [...draft.levels].sort((a, b) => a.target - b.target),
    };
    if (def) {
      updateObjective(def.id, data);
      notify("Obiettivo salvato");
    } else {
      addObjective(data);
      notify("Obiettivo creato");
    }
    router.push("/mbo/obiettivi");
  };

  const actions = (
    <div className="flex gap-2">
      <GhostButton onClick={() => router.push("/mbo/obiettivi")}>Annulla</GhostButton>
      <PrimaryButton onClick={save}>{def ? "Salva obiettivo" : "Crea obiettivo"}</PrimaryButton>
    </div>
  );

  return (
    <div className="mx-auto max-w-[920px] space-y-4 pb-20">
      <Link href="/mbo/obiettivi" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Obiettivi
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-bold leading-tight">{def ? "Modifica obiettivo" : "Nuovo obiettivo"}</h1>
          {def && <p className="mt-0.5 text-[12.5px] text-muted">{def.name}</p>}
        </div>
        {actions}
      </div>

      {usedIn > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-[12.5px] text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Questo obiettivo è usato in <strong>{usedIn} schede</strong>. Livelli, payout e modalità di calcolo modificati qui si applicano a
            tutte, compreso il payout già calcolato.
          </span>
        </div>
      )}

      <section className="card p-5">
        <SectionTitle n={1} title="Classificazione" />
        <div className="grid gap-4 sm:grid-cols-[240px_1fr]">
          <Block label="Categoria">
            <select className={inputCls} value={draft.category} onChange={(e) => patch({ category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Block>
          <Block label="Descrizione" hint="Come si misura, fonte del dato">
            <textarea
              rows={2}
              className={`${inputCls} resize-y`}
              value={draft.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="es. Ricavi netti da controllo di gestione, consuntivati a fine anno"
            />
          </Block>
        </div>
      </section>

      <section className="card p-5">
        <SectionTitle n={2} title="Misurazione e payout" />
        <CustomObjectiveEditor def={draft} onChange={patch} error={submitted ? (error ?? undefined) : undefined} />
      </section>

      <div className="flex justify-end">{actions}</div>
    </div>
  );
}

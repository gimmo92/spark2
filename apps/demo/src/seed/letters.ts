// Demo letter templates for Valmec S.p.A. (invented letterhead in /public).
import type { LetterTemplate } from "@spark/core";

const letterhead = {
  first: "/letterhead-valmec.pdf",
  firstName: "letterhead-valmec.pdf",
  next: "/letterhead-valmec-next.pdf",
  nextName: "letterhead-valmec-next.pdf",
};
const margins = { top: 48, topNext: 30, bottom: 28, left: 25, right: 25 };

export const SEED_LETTERS: LetterTemplate[] = [
  {
    id: "lt-assegnazione",
    name: "Lettera di assegnazione obiettivi",
    category: "Assegnazione obiettivi",
    letterhead,
    margins,
    fontSize: 10.5,
    updatedAt: "2026-01-12",
    body: `Monza, {{data}}

Gentile **{{nome_completo}}**
{{ruolo}} · {{team}}

**Oggetto: assegnazione obiettivi MBO · {{anno}}**

con la presente le comunichiamo gli obiettivi individuali assegnati per il periodo {{anno}}, nell'ambito del sistema di incentivazione MBO aziendale.

{{tabella_obiettivi}}

Il premio maturerà in base al raggiungimento di ciascun obiettivo, secondo il peso e i livelli indicati. Obiettivo soglia: {{soglia}}.

Il suo responsabile, {{responsabile}}, resta a disposizione per qualsiasi chiarimento.

Cordiali saluti

**Direzione Risorse Umane**
Valmec S.p.A.`,
  },
  {
    id: "lt-consuntivo",
    name: "Lettera di consuntivazione MBO",
    category: "Consuntivazione",
    letterhead,
    margins,
    fontSize: 10.5,
    updatedAt: "2026-01-12",
    body: `Monza, {{data}}

Gentile **{{nome_completo}}**

**Oggetto: consuntivazione obiettivi MBO · {{anno}}**

a conclusione del periodo {{anno}} le comunichiamo i risultati raggiunti sugli obiettivi della scheda "{{scheda}}".

{{tabella_consuntivo}}

Il payout complessivo risultante è pari al **{{payout}}** del premio target.

Cordiali saluti

**Direzione Risorse Umane**`,
  },
  {
    id: "lt-premio",
    name: "Lettera di comunicazione premio",
    category: "Comunicazione premio",
    letterhead,
    margins,
    fontSize: 10.5,
    updatedAt: "2026-01-12",
    body: `Monza, {{data}}

Gentile **{{nome_completo}}**

**Oggetto: premio MBO · {{anno}}**

siamo lieti di comunicarle che, sulla base dei risultati consuntivati, il payout del suo piano MBO {{anno}} è pari al **{{payout}}** del premio target.

L'importo sarà corrisposto con la retribuzione del mese successivo alla presente comunicazione.

La ringraziamo per il contributo e le auguriamo buon lavoro.

**Direzione Risorse Umane**

Per presa visione: ______________________`,
  },
];

/** Labels used by the demo workflows before letter templates existed. */
export const LEGACY_LETTER_IDS: Record<string, string> = {
  "Lettera di assegnazione obiettivi": "lt-assegnazione",
  "Lettera di consuntivazione MBO": "lt-consuntivo",
  "Lettera di comunicazione premio": "lt-premio",
};

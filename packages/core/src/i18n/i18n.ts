import { EN as CORE_EN } from "./en";

/**
 * UI translations. The Italian copy is the key: `tr("Salva")` returns the text in the active
 * language, or the Italian itself when a translation is missing. Dictionaries: core (./en.ts),
 * each module (`SparkModule.messages`), each client app (`SparkConfig.messages`).
 * Placeholders: `tr("{0} utenti attivi", [n])` or `tr("Ciao {nome}", { nome })`.
 */
export type Locale = "it" | "en";

export const LOCALES: { id: Locale; label: string; short: string }[] = [
  { id: "it", label: "Italiano", short: "IT" },
  { id: "en", label: "English", short: "EN" },
];

/** Translations by language, keyed by the Italian text. `it` may reword the default copy for one client. */
export type Messages = Partial<Record<Locale, Record<string, string>>>;

const dicts: Record<Locale, Record<string, string>> = { it: {}, en: { ...CORE_EN } };
let active: Locale = "it";

/** Adds module / client dictionaries (later ones win). */
export function addMessages(m?: Messages) {
  if (!m) return;
  for (const l of Object.keys(m) as Locale[]) Object.assign(dicts[l], m[l]);
}

type Value = string | number | null | undefined;
type Vars = Value[] | Record<string, Value>;

/** Translate a UI text (Italian key) into the active language. Nullish → "". */
export function tr(text: string | null | undefined, vars?: Vars): string {
  if (text == null) return "";
  const s = dicts[active][text] ?? text;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    const known = Array.isArray(vars) ? Number(k) < vars.length : k in vars;
    const v = Array.isArray(vars) ? vars[Number(k)] : vars[k];
    return known ? String(v ?? "") : m;
  });
}

/** Language currently rendered. */
export const currentLocale = () => active;
/** BCP-47 tag for dates and numbers in the active language. */
export const localeTag = () => (active === "en" ? "en-GB" : "it-IT");

/** Set by LocaleProvider while rendering: every `tr` below it uses this language. */
export function setActiveLocale(l: Locale) {
  active = l;
}

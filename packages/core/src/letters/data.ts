/**
 * Letters (Azienda → Gestione Lettere), owned by the core.
 *
 * A template is the client's letterhead (a PDF used as page background) plus a text with
 * {{variables}}. The core provides the person variables; modules add theirs (`SparkModule.letters`),
 * e.g. MBO adds the scheda, the payout and the table of objectives.
 */
import type { Doc } from "../config";
import { fullName, type User } from "../people/data";

export interface LetterTemplate {
  id: string;
  name: string;
  /** Free label to group templates, e.g. "Assegnazione obiettivi". */
  category?: string;
  /** Letter text: paragraphs separated by a blank line, **bold**, {{variables}}. A table variable must sit on its own line. */
  body: string;
  /** Letterhead PDFs (data: URL of an upload or a path under /public). `next` is used from page 2 on (default: `first`). */
  letterhead?: { first?: string; next?: string; firstName?: string; nextName?: string };
  /** Text area inside the letterhead, in millimetres from the page edges. */
  margins: { top: number; bottom: number; left: number; right: number; topNext?: number };
  fontSize: number;
  updatedAt?: string;
}

export const LETTER_CATEGORIES = ["Assegnazione obiettivi", "Consuntivazione", "Comunicazione premio", "Altro"];

export const DEFAULT_MARGINS: LetterTemplate["margins"] = { top: 45, bottom: 30, left: 25, right: 25 };

/** A variable value: text, or a table (rendered as a grid when the variable sits on its own line). */
export type LetterValue = string | { head: string[]; rows: string[][]; widths?: number[] };

export interface LetterVariable {
  key: string;
  label: string;
  /** Section of the variables list, e.g. "Persona", "MBO". */
  group: string;
  /** Table variables must be on their own line. */
  table?: boolean;
}

/** Data available when filling a letter for one person. */
export interface LetterContext {
  user: User;
  users: User[];
  /** Every collection of the app, keyed by name (modules read their own). */
  data: Record<string, Doc[]>;
  orgName: string;
}

/** What a module adds to letters: its variables and how to fill them for a person. */
export interface LetterSource {
  variables: LetterVariable[];
  values: (ctx: LetterContext) => Record<string, LetterValue>;
}

const P = "Persona";
const O = "Azienda";

export const CORE_LETTER_VARIABLES: LetterVariable[] = [
  { key: "nome", label: "Nome", group: P },
  { key: "cognome", label: "Cognome", group: P },
  { key: "nome_completo", label: "Nome e cognome", group: P },
  { key: "email", label: "Email", group: P },
  { key: "ruolo", label: "Ruolo", group: P },
  { key: "team", label: "Team", group: P },
  { key: "societa", label: "Società", group: P },
  { key: "responsabile", label: "Responsabile", group: P },
  { key: "azienda", label: "Organizzazione", group: O },
  { key: "data", label: "Data di oggi", group: O },
];

export const todayLabel = () => new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

export function coreLetterValues(ctx: LetterContext): Record<string, LetterValue> {
  const u = ctx.user;
  const manager = u.managerId ? ctx.users.find((x) => x.id === u.managerId) : undefined;
  return {
    nome: u.firstName,
    cognome: u.lastName,
    nome_completo: fullName(u),
    email: u.email,
    ruolo: u.role,
    team: u.team,
    societa: u.company,
    responsabile: manager ? fullName(manager) : "",
    azienda: ctx.orgName,
    data: todayLabel(),
  };
}

/** {{keys}} used in a text, in order of appearance. */
export const usedVariables = (body: string) => [...new Set([...body.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map((m) => m[1]))];

/** Variables of a text that no source defines (typos, removed modules). */
export const unknownVariables = (body: string, vars: LetterVariable[]) => usedVariables(body).filter((k) => !vars.some((v) => v.key === k));

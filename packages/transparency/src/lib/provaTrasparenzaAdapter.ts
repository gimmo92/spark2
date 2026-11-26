import {
  COLUMN_ROLES,
  getRoleLabel,
  MAPPING_REQUIRED_ROLES,
  type ColumnMapping,
  type ColumnRole,
} from "./columnRoles";

export { COLUMN_ROLES, MAPPING_REQUIRED_ROLES };
export type { ColumnMapping, ColumnRole };

/** Header row of `Tracciato_tea_esempio.xlsx`, in sheet order. */
export const TEA_EXPECTED_HEADERS: string[] = [
  "ID dipendente",
  "Nome",
  "Cognome",
  "Sesso",
  "Data assunzione",
  "Data cessazione",
  "CCNL",
  "Società",
  "Qualifica",
  "Livello CCNL",
  "Ruolo / job title",
  "Orario settimanale full-time (ore)",
  "% part-time",
  "Minimo tabellare mensile (€)",
  "Superminimo non assorbibile mensile (€)",
  "Superminimo assorbibile mensile (€)",
  "Scatti di anzianità mensile(€)",
  "Forfait straordinari voce mensile  (€)",
  "Altre voci fisse mensili (€)",
  "RAL annua (€)",
  "Bonus / MBO  base 100 (€)",
  "Bonus / MBO erogato (€)",
  "Premio di risultato base 100 (€)",
  "Straordinari (€)",
  "Indennità variabili (€)",
  "Una tantum (€)",
  "Fringe benefit valore annuo (€)",
  "Welfare aziendale annuo (€)",
  "Codice Mansione",
  "Cod CDR",
  "Descrizione CdR",
  "Valutazione media Soft Skills",
  "Valutazione media Hard Skills",
  "Valutazione media Complessiva",
  "Grade",
  "Banda",
  "Famiglia professionale",
  "Livello di istruzione",
];

/** Header row of `Tracciato_Spark_Tea_v2`, in sheet order. */
export const TEA_V2_EXPECTED_HEADERS: string[] = [
  "ID dipendente",
  "Nome",
  "Cognome",
  "Sesso",
  "Data assunzione",
  "Data cessazione",
  "CCNL",
  "Società",
  "Qualifica",
  "Livello CCNL",
  "Ruolo / job title",
  "Orario settimanale full-time (ore)",
  "% part-time",
  "Minimo tabellare mensile (€)",
  "Superminimo non assorbibile mensile (€)",
  "Superminimo assorbibile mensile (€)",
  "Scatti di anzianità mensile(€)",
  "Forfait straordinari voce mensile (€)",
  "Altre voci fisse mensili (€)",
  "Retribuzione oraria (€)",
  "RAL annua (€)",
  "Bonus / MBO target – competenza 2026 (€)",
  "Bonus / MBO erogato nel 2026 – competenza 2025 (€)",
  "Premio di risultato base 100 (€)",
  "Straordinari (€)",
  "Indennità variabili (€)",
  "Una tantum (€)",
  "Fringe benefit valore annuo (€)",
  "Welfare aziendale annuo (€)",
  "Codice Mansione",
  "Cod CDR",
  "Descrizione CdR",
  "Valutazione media Soft Skills",
  "Valutazione media Hard Skills",
  "Valutazione media Complessiva",
  "Grade",
  "Banda",
  "Famiglia professionale",
  "Livello di istruzione",
];

const TEA_HEADER_RULES: Array<{ role: ColumnRole; re: RegExp }> = [
  { role: COLUMN_ROLES.employeeId, re: /^id dipendente$/ },
  { role: COLUMN_ROLES.firstName, re: /^nome$/ },
  { role: COLUMN_ROLES.lastName, re: /^cognome$/ },
  { role: COLUMN_ROLES.gender, re: /^sesso( f m)?$/ },
  { role: COLUMN_ROLES.hireDate, re: /^data assunzione$/ },
  { role: COLUMN_ROLES.terminationDate, re: /^data cessazione$/ },
  { role: COLUMN_ROLES.ccnl, re: /^ccnl$/ },
  { role: COLUMN_ROLES.company, re: /^societa$/ },
  { role: COLUMN_ROLES.qualification, re: /^qualifica$/ },
  { role: COLUMN_ROLES.level, re: /^livello ccnl$/ },
  { role: COLUMN_ROLES.role, re: /^ruolo( job title)?$/ },
  { role: COLUMN_ROLES.weeklyFullTimeHours, re: /^orario settimanale full time/ },
  { role: COLUMN_ROLES.partTimePct, re: /^%? ?part time$/ },
  { role: COLUMN_ROLES.ccnlMinimum, re: /^minimo tabellare mensile/ },
  { role: COLUMN_ROLES.superminimo, re: /^superminimo non assorbibile mensile/ },
  { role: COLUMN_ROLES.superminimoAssoluto, re: /^superminimo assorbibile mensile/ },
  { role: COLUMN_ROLES.senioritySteps, re: /^scatti di anzianita mensile/ },
  { role: COLUMN_ROLES.forfaitOvertime, re: /^forfait straordinari/ },
  { role: COLUMN_ROLES.otherFixedItems, re: /^altre voci fisse mensili/ },
  { role: COLUMN_ROLES.reportedHourly, re: /^retribuzione oraria/ },
  { role: COLUMN_ROLES.baseSalary, re: /^ral annua/ },
  { role: COLUMN_ROLES.mboBase100, re: /^bonus mbo (base 100|target)/ },
  { role: COLUMN_ROLES.bonusMbo, re: /^bonus mbo erogato/ },
  { role: COLUMN_ROLES.resultBonusPaid, re: /^premio di risultato erogato/ },
  { role: COLUMN_ROLES.resultBonus, re: /^premio di risultato/ },
  { role: COLUMN_ROLES.mealTicketAnnual, re: /^ticket pasto/ },
  { role: COLUMN_ROLES.otherAnnual, re: /^altro annuo/ },
  { role: COLUMN_ROLES.incentiveAwards, re: /^premi incentivanti/ },
  { role: COLUMN_ROLES.liberalPayments, re: /^erogazioni liberali/ },
  { role: COLUMN_ROLES.overtime, re: /^straordinari$/ },
  { role: COLUMN_ROLES.variableAllowances, re: /^indennita variabili/ },
  { role: COLUMN_ROLES.oneOffPayment, re: /^una tantum/ },
  { role: COLUMN_ROLES.fringeBenefits, re: /^fringe benefit/ },
  { role: COLUMN_ROLES.companyWelfare, re: /^welfare aziendale/ },
  { role: COLUMN_ROLES.jobCode, re: /^codice mansione$/ },
  { role: COLUMN_ROLES.costCenterCode, re: /^cod cdr$/ },
  { role: COLUMN_ROLES.costCenterDescription, re: /^descrizione cdr$/ },
  { role: COLUMN_ROLES.softSkills, re: /soft skills/ },
  { role: COLUMN_ROLES.hardSkills, re: /hard skills/ },
  { role: COLUMN_ROLES.performanceScore, re: /valutazione media complessiva/ },
  { role: COLUMN_ROLES.grade, re: /^grade$/ },
  { role: COLUMN_ROLES.payBand, re: /^banda$/ },
  { role: COLUMN_ROLES.jobFamily, re: /^famiglia professionale$/ },
  { role: COLUMN_ROLES.educationLevel, re: /^livello di istruzione$/ },
];

export function normalizeHeaderLabel(header: unknown): string {
  return String(header ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/€/g, " ")
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @deprecated use normalizeHeaderLabel */
export function normalizeHeader(value: unknown): string {
  return normalizeHeaderLabel(value);
}

/**
 * Exact TEA tracciato match. Null when the file is not that layout.
 * Monthly labels and annual RAL are not interchangeable.
 */
export function matchTeaHeaders(headers: unknown[]): ColumnMapping | null {
  const norm = (headers || []).map(normalizeHeaderLabel);
  const used = new Set<number>();
  const result: ColumnMapping = {};
  for (const rule of TEA_HEADER_RULES) {
    const idx = norm.findIndex((h, i) => !used.has(i) && rule.re.test(h));
    if (idx >= 0) {
      result[rule.role] = idx;
      used.add(idx);
    }
  }
  const anchored =
    result[COLUMN_ROLES.baseSalary] != null &&
    (result[COLUMN_ROLES.ccnlMinimum] != null ||
      result[COLUMN_ROLES.superminimo] != null ||
      result[COLUMN_ROLES.forfaitOvertime] != null);
  if (!anchored || Object.keys(result).length < 8) return null;
  if (
    result[COLUMN_ROLES.costCenterDescription] != null &&
    result[COLUMN_ROLES.category] == null
  ) {
    result[COLUMN_ROLES.category] = result[COLUMN_ROLES.costCenterDescription];
  }
  return result;
}

export function isTeaTracciato(headers: unknown[]): boolean {
  return matchTeaHeaders(headers) != null;
}

export function mapWithAdapter(headers: unknown[]): ColumnMapping {
  return matchTeaHeaders(headers) ?? {};
}

export type SchemaCheckResult = {
  ok: boolean;
  tea: boolean;
  matched: string[];
  missingRequired: string[];
  missingOptional: string[];
  unexpected: string[];
  mapping: ColumnMapping;
};

function nonemptyHeaders(headers: unknown[]): string[] {
  return (headers || [])
    .map((h) => (h == null ? "" : String(h)))
    .filter((h) => h.trim() !== "");
}

export function checkSchema(headers: unknown[]): SchemaCheckResult {
  const fileHeaders = nonemptyHeaders(headers);
  const mapping = matchTeaHeaders(headers);
  if (!mapping) {
    return {
      ok: false,
      tea: false,
      matched: [],
      missingRequired: [],
      missingOptional: [],
      unexpected: fileHeaders,
      mapping: {},
    };
  }

  const used = new Set<number>();
  for (const idx of Object.values(mapping)) {
    if (idx != null && idx >= 0) used.add(idx);
  }

  const matched: string[] = [];
  const unexpected: string[] = [];
  headers.forEach((header, idx) => {
    const label = header == null ? "" : String(header).trim();
    if (!label) return;
    if (used.has(idx)) matched.push(label);
    else unexpected.push(label);
  });

  const missingRequired = MAPPING_REQUIRED_ROLES.filter(
    (role) => mapping[role] == null
  ).map((role) => getRoleLabel(role));

  return {
    ok: true,
    tea: true,
    matched,
    missingRequired,
    missingOptional: [],
    unexpected,
    mapping,
  };
}

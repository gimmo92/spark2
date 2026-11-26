export const COLUMN_ROLES = {
  gender: "gender",
  employeeName: "employeeName",
  baseSalary: "baseSalary",
  variableComponents: "variableComponents",
  totalSalary: "totalSalary",
  category: "category",
  role: "role",
  level: "level",
  description: "description",
  seniority: "seniority",
  roleSeniority: "roleSeniority",
  performanceScore: "performanceScore",
  partTimePct: "partTimePct",
  hireDate: "hireDate",
  terminationDate: "terminationDate",
  senioritySteps: "senioritySteps",
  otherFixedItems: "otherFixedItems",
  bonusMbo: "bonusMbo",
  resultBonus: "resultBonus",
  overtime: "overtime",
  variableAllowances: "variableAllowances",
  oneOffPayment: "oneOffPayment",
  fringeBenefits: "fringeBenefits",
  companyWelfare: "companyWelfare",
  mealTicketAnnual: "mealTicketAnnual",
  otherAnnual: "otherAnnual",
  incentiveAwards: "incentiveAwards",
  liberalPayments: "liberalPayments",
  resultBonusPaid: "resultBonusPaid",
  employeeId: "employeeId",
  firstName: "firstName",
  lastName: "lastName",
  company: "company",
  qualification: "qualification",
  weeklyFullTimeHours: "weeklyFullTimeHours",
  forfaitOvertime: "forfaitOvertime",
  mboBase100: "mboBase100",
  reportedHourly: "reportedHourly",
  jobCode: "jobCode",
  costCenterCode: "costCenterCode",
  costCenterDescription: "costCenterDescription",
  softSkills: "softSkills",
  hardSkills: "hardSkills",
  grade: "grade",
  payBand: "payBand",
  jobFamily: "jobFamily",
  educationLevel: "educationLevel",
  ccnl: "ccnl",
  structuralComponents: "structuralComponents",
  individualComponents: "individualComponents",
  ccnlMinimum: "ccnlMinimum",
  superminimo: "superminimo",
  superminimoAssoluto: "superminimoAssoluto",
} as const;

export type ColumnRole = (typeof COLUMN_ROLES)[keyof typeof COLUMN_ROLES];

export type ColumnMapping = Partial<Record<ColumnRole, number>>;

export const MAPPING_REQUIRED_ROLES: ColumnRole[] = [
  COLUMN_ROLES.gender,
  COLUMN_ROLES.level,
  COLUMN_ROLES.baseSalary,
  COLUMN_ROLES.superminimo,
  COLUMN_ROLES.superminimoAssoluto,
  COLUMN_ROLES.terminationDate,
  COLUMN_ROLES.hireDate,
  COLUMN_ROLES.senioritySteps,
  COLUMN_ROLES.otherFixedItems,
  COLUMN_ROLES.bonusMbo,
  COLUMN_ROLES.resultBonus,
  COLUMN_ROLES.overtime,
  COLUMN_ROLES.variableAllowances,
  COLUMN_ROLES.oneOffPayment,
  COLUMN_ROLES.fringeBenefits,
  COLUMN_ROLES.companyWelfare,
];

export const MAPPING_RECOMMENDED_ROLES: ColumnRole[] = [
  COLUMN_ROLES.partTimePct,
  COLUMN_ROLES.ccnl,
  COLUMN_ROLES.ccnlMinimum,
];

export type MappingField = {
  role: ColumnRole;
  badge?: "required" | "recommended";
};

export type MappingSection = {
  id: string;
  titleKey: string;
  fields: MappingField[];
};

/** Single import mask: TEA columns, in file order. */
export const MAPPING_UI_SECTIONS: MappingSection[] = [
  {
    id: "tea",
    titleKey: "compensationPage.mappingTeaTitle",
    fields: [
      { role: COLUMN_ROLES.employeeId },
      { role: COLUMN_ROLES.firstName },
      { role: COLUMN_ROLES.lastName },
      { role: COLUMN_ROLES.gender, badge: "required" },
      { role: COLUMN_ROLES.hireDate, badge: "required" },
      { role: COLUMN_ROLES.terminationDate, badge: "required" },
      { role: COLUMN_ROLES.ccnl, badge: "recommended" },
      { role: COLUMN_ROLES.company },
      { role: COLUMN_ROLES.qualification },
      { role: COLUMN_ROLES.level, badge: "required" },
      { role: COLUMN_ROLES.role },
      { role: COLUMN_ROLES.weeklyFullTimeHours },
      { role: COLUMN_ROLES.partTimePct, badge: "recommended" },
      { role: COLUMN_ROLES.ccnlMinimum, badge: "recommended" },
      { role: COLUMN_ROLES.superminimo, badge: "required" },
      { role: COLUMN_ROLES.superminimoAssoluto, badge: "required" },
      { role: COLUMN_ROLES.senioritySteps, badge: "required" },
      { role: COLUMN_ROLES.forfaitOvertime },
      { role: COLUMN_ROLES.otherFixedItems, badge: "required" },
      { role: COLUMN_ROLES.reportedHourly },
      { role: COLUMN_ROLES.baseSalary, badge: "required" },
      { role: COLUMN_ROLES.mboBase100 },
      { role: COLUMN_ROLES.bonusMbo, badge: "required" },
      { role: COLUMN_ROLES.resultBonus, badge: "required" },
      { role: COLUMN_ROLES.overtime, badge: "required" },
      { role: COLUMN_ROLES.variableAllowances, badge: "required" },
      { role: COLUMN_ROLES.oneOffPayment, badge: "required" },
      { role: COLUMN_ROLES.fringeBenefits, badge: "required" },
      { role: COLUMN_ROLES.companyWelfare, badge: "required" },
      { role: COLUMN_ROLES.mealTicketAnnual },
      { role: COLUMN_ROLES.otherAnnual },
      { role: COLUMN_ROLES.incentiveAwards },
      { role: COLUMN_ROLES.liberalPayments },
      { role: COLUMN_ROLES.resultBonusPaid },
      { role: COLUMN_ROLES.jobCode },
      { role: COLUMN_ROLES.costCenterCode },
      { role: COLUMN_ROLES.costCenterDescription },
      { role: COLUMN_ROLES.softSkills },
      { role: COLUMN_ROLES.hardSkills },
      { role: COLUMN_ROLES.performanceScore },
      { role: COLUMN_ROLES.grade },
      { role: COLUMN_ROLES.payBand },
      { role: COLUMN_ROLES.jobFamily },
      { role: COLUMN_ROLES.educationLevel },
    ],
  },
];

const ROLE_LABELS: Record<ColumnRole, string> = {
  [COLUMN_ROLES.gender]: "Sesso (F/M)",
  [COLUMN_ROLES.employeeName]: "Nome dipendente",
  [COLUMN_ROLES.baseSalary]: "RAL annua",
  [COLUMN_ROLES.reportedHourly]: "Retribuzione oraria",
  [COLUMN_ROLES.variableComponents]: "Componenti variabili (legacy)",
  [COLUMN_ROLES.totalSalary]: "Retribuzione totale annua (legacy)",
  [COLUMN_ROLES.category]: "Descrizione CdR / centro di costo",
  [COLUMN_ROLES.role]: "Ruolo / job title",
  [COLUMN_ROLES.level]: "Livello CCNL",
  [COLUMN_ROLES.description]: "Descrizione ruolo",
  [COLUMN_ROLES.seniority]: "Anzianità",
  [COLUMN_ROLES.roleSeniority]: "Anzianità nel ruolo",
  [COLUMN_ROLES.performanceScore]: "Valutazione media complessiva (1–5)",
  [COLUMN_ROLES.partTimePct]: "% part-time",
  [COLUMN_ROLES.hireDate]: "Data assunzione",
  [COLUMN_ROLES.terminationDate]: "Data cessazione",
  [COLUMN_ROLES.senioritySteps]: "Scatti di anzianità mensili",
  [COLUMN_ROLES.otherFixedItems]: "Altre voci fisse mensili",
  [COLUMN_ROLES.bonusMbo]: "Bonus / MBO erogato",
  [COLUMN_ROLES.resultBonus]: "Premio di risultato base 100",
  [COLUMN_ROLES.overtime]: "Straordinari (annui)",
  [COLUMN_ROLES.variableAllowances]: "Indennità variabili",
  [COLUMN_ROLES.oneOffPayment]: "Una tantum",
  [COLUMN_ROLES.fringeBenefits]: "Fringe benefit annuo",
  [COLUMN_ROLES.companyWelfare]: "Welfare aziendale annuo",
  [COLUMN_ROLES.mealTicketAnnual]: "Ticket pasto annuo",
  [COLUMN_ROLES.otherAnnual]: "Altro annuo",
  [COLUMN_ROLES.incentiveAwards]: "Premi incentivanti",
  [COLUMN_ROLES.liberalPayments]: "Erogazioni liberali",
  [COLUMN_ROLES.resultBonusPaid]: "Premio di risultato erogato",
  [COLUMN_ROLES.employeeId]: "ID dipendente",
  [COLUMN_ROLES.firstName]: "Nome",
  [COLUMN_ROLES.lastName]: "Cognome",
  [COLUMN_ROLES.company]: "Società",
  [COLUMN_ROLES.qualification]: "Qualifica",
  [COLUMN_ROLES.weeklyFullTimeHours]: "Orario settimanale full-time (ore)",
  [COLUMN_ROLES.forfaitOvertime]: "Forfait straordinari mensile",
  [COLUMN_ROLES.mboBase100]: "Bonus / MBO target (competenza)",
  [COLUMN_ROLES.jobCode]: "Codice mansione",
  [COLUMN_ROLES.costCenterCode]: "Cod CdR",
  [COLUMN_ROLES.costCenterDescription]: "Descrizione CdR",
  [COLUMN_ROLES.softSkills]: "Valutazione media soft skills (1–5)",
  [COLUMN_ROLES.hardSkills]: "Valutazione media hard skills (1–5)",
  [COLUMN_ROLES.grade]: "Grade",
  [COLUMN_ROLES.payBand]: "Banda",
  [COLUMN_ROLES.jobFamily]: "Famiglia professionale",
  [COLUMN_ROLES.educationLevel]: "Livello di istruzione",
  [COLUMN_ROLES.ccnl]: "CCNL",
  [COLUMN_ROLES.structuralComponents]: "Componenti strutturali",
  [COLUMN_ROLES.individualComponents]: "Componenti individuali",
  [COLUMN_ROLES.ccnlMinimum]: "Minimo tabellare mensile",
  [COLUMN_ROLES.superminimo]: "Superminimo non assorbibile mensile",
  [COLUMN_ROLES.superminimoAssoluto]: "Superminimo assorbibile mensile",
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role as ColumnRole] ?? role;
}

export function isMappingRoleAssigned(
  mapping: ColumnMapping | null | undefined,
  role: ColumnRole
): boolean {
  if (!mapping || role == null) return false;
  const idx = mapping[role];
  return Number.isFinite(idx) && (idx as number) >= 0;
}

export function missingRequiredMappingRoles(
  mapping: ColumnMapping | null | undefined
): ColumnRole[] {
  return MAPPING_REQUIRED_ROLES.filter(
    (role) => !isMappingRoleAssigned(mapping, role)
  );
}

export function missingRecommendedMappingRoles(
  mapping: ColumnMapping | null | undefined
): ColumnRole[] {
  return MAPPING_RECOMMENDED_ROLES.filter(
    (role) => !isMappingRoleAssigned(mapping, role)
  );
}

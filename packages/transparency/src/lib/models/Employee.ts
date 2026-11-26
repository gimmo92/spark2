import {
  DEFAULT_ANNUAL_HOURS,
  type Gender,
  SALARY_METRICS,
  type SalaryMetric,
} from "./constants";
import { SalaryMath } from "../analysis/SalaryMath";

export type PaySchema = "tea" | "legacy";

export type EmployeeJson = {
  index: number;
  gender: Gender;
  name: string | null;
  category: string | null;
  role: string | null;
  level: string | null;
  description: string | null;
  seniority: unknown;
  roleSeniority: unknown;
  performanceScore: number | null;
  hireDate: unknown;
  ccnl: string | null;
  ccnlMinimum: number | null;
  partTimePct: number;
  baseSalaryRaw: number;
  superminimo: number;
  superminimoAssoluto: number;
  baseSalary: number;
  structuralComponents: number;
  individualComponents: number;
  livelloRetributivo: number;
  totalSalary: number;
  variableComponents: number;
  structuralComponentsFte: number;
  individualComponentsFte: number;
  variableComponentsFte: number;
  baseSalaryFte: number;
  livelloRetributivoFte: number;
  totalSalaryFte: number;
  baseSalaryHourly: number;
  livelloRetributivoHourly: number;
  totalSalaryHourly: number;
  variableComponentsHourly: number;
  paySchema?: PaySchema;
  employeeId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  qualification?: string | null;
  weeklyFullTimeHours?: number;
  terminationDate?: unknown;
  senioritySteps?: number;
  otherFixedItems?: number;
  bonusMbo?: number;
  resultBonus?: number;
  overtime?: number;
  variableAllowances?: number;
  oneOffPayment?: number;
  fringeBenefits?: number;
  companyWelfare?: number;
  mealTicketAnnual?: number;
  otherAnnual?: number;
  incentiveAwards?: number;
  liberalPayments?: number;
  resultBonusPaid?: number;
  forfaitOvertime?: number;
  mboBase100?: number;
  reportedHourly?: number | null;
  jobCode?: string | null;
  costCenterCode?: string | null;
  costCenterDescription?: string | null;
  softSkills?: number | null;
  hardSkills?: number | null;
  performanceOnFive?: number | null;
  grade?: string | null;
  payBand?: string | null;
  jobFamily?: string | null;
  educationLevel?: string | null;
  hourlyAnnualHours?: number;
  ralDateProrated?: boolean;
  monthlyAddedToRal?: boolean;
};

const TEA_DEFAULTS = {
  paySchema: "legacy" as PaySchema,
  employeeId: null as string | null,
  firstName: null as string | null,
  lastName: null as string | null,
  company: null as string | null,
  qualification: null as string | null,
  weeklyFullTimeHours: 0,
  terminationDate: null as unknown,
  senioritySteps: 0,
  otherFixedItems: 0,
  bonusMbo: 0,
  resultBonus: 0,
  overtime: 0,
  variableAllowances: 0,
  oneOffPayment: 0,
  fringeBenefits: 0,
  companyWelfare: 0,
  mealTicketAnnual: 0,
  otherAnnual: 0,
  incentiveAwards: 0,
  liberalPayments: 0,
  resultBonusPaid: 0,
  forfaitOvertime: 0,
  mboBase100: 0,
  reportedHourly: null as number | null,
  jobCode: null as string | null,
  costCenterCode: null as string | null,
  costCenterDescription: null as string | null,
  softSkills: null as number | null,
  hardSkills: null as number | null,
  performanceOnFive: null as number | null,
  grade: null as string | null,
  payBand: null as string | null,
  jobFamily: null as string | null,
  educationLevel: null as string | null,
  hourlyAnnualHours: DEFAULT_ANNUAL_HOURS,
  ralDateProrated: false,
  monthlyAddedToRal: false,
};

export type TeaSalaryInput = {
  index: number;
  gender: Gender;
  name?: unknown;
  employeeId?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  company?: unknown;
  qualification?: unknown;
  category?: unknown;
  role?: unknown;
  level?: unknown;
  description?: unknown;
  seniority?: unknown;
  roleSeniority?: unknown;
  performanceScore?: number | null;
  performanceOnFive?: number | null;
  hireDate?: unknown;
  terminationDate?: unknown;
  ccnl?: string | null;
  ccnlMinimum?: number | null;
  partTimePct?: number;
  weeklyFullTimeHours?: number;
  baseSalary?: number;
  superminimo?: number;
  superminimoAssoluto?: number;
  senioritySteps?: number;
  otherFixedItems?: number;
  forfaitOvertime?: number;
  mboBase100?: number;
  reportedHourly?: number | null;
  bonusMbo?: number;
  resultBonus?: number;
  overtime?: number;
  variableAllowances?: number;
  oneOffPayment?: number;
  fringeBenefits?: number;
  companyWelfare?: number;
  mealTicketAnnual?: number;
  otherAnnual?: number;
  incentiveAwards?: number;
  liberalPayments?: number;
  resultBonusPaid?: number;
  jobCode?: unknown;
  costCenterCode?: unknown;
  costCenterDescription?: unknown;
  softSkills?: number | null;
  hardSkills?: number | null;
  grade?: unknown;
  payBand?: unknown;
  jobFamily?: unknown;
  educationLevel?: unknown;
};

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

export class Employee {
  index!: number;
  gender!: Gender;
  name!: string | null;
  category!: string | null;
  role!: string | null;
  level!: string | null;
  description!: string | null;
  seniority!: unknown;
  roleSeniority!: unknown;
  performanceScore!: number | null;
  hireDate!: unknown;
  ccnl!: string | null;
  ccnlMinimum!: number | null;
  partTimePct!: number;
  baseSalaryRaw!: number;
  superminimo!: number;
  superminimoAssoluto!: number;
  baseSalary!: number;
  structuralComponents!: number;
  individualComponents!: number;
  livelloRetributivo!: number;
  totalSalary!: number;
  variableComponents!: number;
  structuralComponentsFte!: number;
  individualComponentsFte!: number;
  variableComponentsFte!: number;
  baseSalaryFte!: number;
  livelloRetributivoFte!: number;
  totalSalaryFte!: number;
  baseSalaryHourly!: number;
  livelloRetributivoHourly!: number;
  totalSalaryHourly!: number;
  variableComponentsHourly!: number;
  paySchema!: PaySchema;
  employeeId!: string | null;
  firstName!: string | null;
  lastName!: string | null;
  company!: string | null;
  qualification!: string | null;
  weeklyFullTimeHours!: number;
  terminationDate!: unknown;
  senioritySteps!: number;
  otherFixedItems!: number;
  bonusMbo!: number;
  resultBonus!: number;
  overtime!: number;
  variableAllowances!: number;
  oneOffPayment!: number;
  fringeBenefits!: number;
  companyWelfare!: number;
  mealTicketAnnual!: number;
  otherAnnual!: number;
  incentiveAwards!: number;
  liberalPayments!: number;
  resultBonusPaid!: number;
  forfaitOvertime!: number;
  mboBase100!: number;
  reportedHourly!: number | null;
  jobCode!: string | null;
  costCenterCode!: string | null;
  costCenterDescription!: string | null;
  softSkills!: number | null;
  hardSkills!: number | null;
  performanceOnFive!: number | null;
  grade!: string | null;
  payBand!: string | null;
  jobFamily!: string | null;
  educationLevel!: string | null;
  hourlyAnnualHours!: number;
  ralDateProrated!: boolean;
  monthlyAddedToRal!: boolean;

  constructor(data: EmployeeJson) {
    Object.assign(this, TEA_DEFAULTS, data);
  }

  /**
   * Legacy payroll import: superminimi are subtracted from the annual base.
   * Kept so previously stored analyses and the unused job-grading helper
   * still reconstruct the same numbers. New TEA files use fromTeaRecord.
   */
  static fromParsedRow(raw: {
    index: number;
    gender: Gender;
    name?: unknown;
    category?: unknown;
    role?: unknown;
    level?: unknown;
    description?: unknown;
    seniority?: unknown;
    roleSeniority?: unknown;
    performanceScore?: number | null;
    hireDate?: unknown;
    ccnl?: string | null;
    ccnlMinimum?: number | null;
    partTimePct?: number;
    baseSalary?: number;
    superminimo?: number;
    superminimoAssoluto?: number;
    structuralComponents?: number | null;
    individualComponents?: number | null;
    variableComponents?: number;
    totalSalary?: number;
  }): Employee {
    const baseSalaryRaw = raw.baseSalary ?? 0;
    const superminimo = raw.superminimo ?? 0;
    const superminimoAssoluto = raw.superminimoAssoluto ?? 0;
    const baseSalary = SalaryMath.effectiveBaseSalary(
      baseSalaryRaw,
      superminimo,
      superminimoAssoluto,
    );

    let structuralComponents = raw.structuralComponents != null
      ? raw.structuralComponents
      : 0;
    const individualComponents = raw.individualComponents != null
      ? raw.individualComponents
      : 0;
    const variableLegacy = raw.variableComponents ?? 0;
    if (
      raw.structuralComponents == null &&
      raw.individualComponents == null &&
      variableLegacy > 0
    ) {
      structuralComponents = variableLegacy;
    }
    const livelloRetributivo = baseSalary + structuralComponents;
    const totalMapped = raw.totalSalary;
    const totalSalary = totalMapped != null && totalMapped > 0
      ? totalMapped
      : livelloRetributivo + individualComponents;
    const variableComponents = structuralComponents + individualComponents;
    const partTimePct = raw.partTimePct != null && raw.partTimePct > 0
      ? raw.partTimePct
      : 100;
    const toFte = (v: number) => SalaryMath.toFte(v, partTimePct);
    const toHourly = (v: number) =>
      SalaryMath.toHourly(v, DEFAULT_ANNUAL_HOURS);

    return new Employee({
      ...TEA_DEFAULTS,
      paySchema: "legacy",
      index: raw.index,
      gender: raw.gender,
      name: raw.name == null ? null : String(raw.name),
      category: raw.category == null ? null : String(raw.category),
      role: raw.role == null ? null : String(raw.role),
      level: raw.level == null ? null : String(raw.level),
      description: raw.description == null ? null : String(raw.description),
      seniority: raw.seniority ?? null,
      roleSeniority: raw.roleSeniority ?? null,
      performanceScore: raw.performanceScore ?? null,
      hireDate: raw.hireDate ?? null,
      ccnl: raw.ccnl ?? null,
      ccnlMinimum: raw.ccnlMinimum ?? null,
      partTimePct,
      baseSalaryRaw,
      superminimo: SalaryMath.parseSalaryAmount(superminimo),
      superminimoAssoluto: SalaryMath.parseSalaryAmount(superminimoAssoluto),
      baseSalary,
      structuralComponents,
      individualComponents,
      livelloRetributivo,
      totalSalary,
      variableComponents,
      structuralComponentsFte: toFte(structuralComponents),
      individualComponentsFte: toFte(individualComponents),
      variableComponentsFte: toFte(variableComponents),
      baseSalaryFte: toFte(baseSalary),
      livelloRetributivoFte: toFte(livelloRetributivo),
      totalSalaryFte: toFte(totalSalary),
      baseSalaryHourly: toHourly(toFte(baseSalary)),
      livelloRetributivoHourly: toHourly(toFte(livelloRetributivo)),
      totalSalaryHourly: toHourly(toFte(totalSalary)),
      variableComponentsHourly: toHourly(toFte(variableComponents)),
      hourlyAnnualHours: DEFAULT_ANNUAL_HOURS,
    });
  }

  /**
   * TEA tracciato. Only annual RAL is scaled to full time.
   * Total adds the MBO target, result-bonus target, fringe, welfare,
   * meal vouchers and other annual amounts at face value.
   * Variable is the paid items except overtime and the overtime lump sum.
   */
  static fromTeaRecord(raw: TeaSalaryInput): Employee {
    const ral = SalaryMath.parseSalaryAmount(raw.baseSalary);
    const partTimePct = raw.partTimePct != null && raw.partTimePct > 0
      ? raw.partTimePct
      : 100;
    const hours = SalaryMath.annualHoursFromWeekly(raw.weeklyFullTimeHours);
    const toFte = (v: number) => SalaryMath.toFte(v, partTimePct);
    const toHourly = (v: number) => SalaryMath.toHourly(v, hours);

    const superminimo = SalaryMath.parseSalaryAmount(raw.superminimo);
    const superminimoAssoluto = SalaryMath.parseSalaryAmount(raw.superminimoAssoluto);
    const ccnlMinimum = raw.ccnlMinimum == null
      ? null
      : SalaryMath.parseSalaryAmount(raw.ccnlMinimum);
    const senioritySteps = SalaryMath.parseSalaryAmount(raw.senioritySteps);
    const forfaitOvertime = SalaryMath.parseSalaryAmount(raw.forfaitOvertime);
    const otherFixedItems = SalaryMath.parseSalaryAmount(raw.otherFixedItems);
    const mboBase100 = SalaryMath.parseSalaryAmount(raw.mboBase100);
    const reportedHourly =
      raw.reportedHourly != null && raw.reportedHourly > 0 ? raw.reportedHourly : null;
    const mboPaid = SalaryMath.parseSalaryAmount(raw.bonusMbo);
    const resultBonus = SalaryMath.parseSalaryAmount(raw.resultBonus);
    const overtime = SalaryMath.parseSalaryAmount(raw.overtime);
    const variableAllowances = SalaryMath.parseSalaryAmount(raw.variableAllowances);
    const oneOffPayment = SalaryMath.parseSalaryAmount(raw.oneOffPayment);
    const fringeBenefits = SalaryMath.parseSalaryAmount(raw.fringeBenefits);
    const companyWelfare = SalaryMath.parseSalaryAmount(raw.companyWelfare);
    const mealTicketAnnual = SalaryMath.parseSalaryAmount(raw.mealTicketAnnual);
    const otherAnnual = SalaryMath.parseSalaryAmount(raw.otherAnnual);
    const incentiveAwards = SalaryMath.parseSalaryAmount(raw.incentiveAwards);
    const liberalPayments = SalaryMath.parseSalaryAmount(raw.liberalPayments);
    const resultBonusPaid = SalaryMath.parseSalaryAmount(raw.resultBonusPaid);

    const baseSalary = ral;
    const baseSalaryFte = toFte(baseSalary);
    const totalAddOns =
      mboBase100 +
      resultBonus +
      fringeBenefits +
      companyWelfare +
      mealTicketAnnual +
      otherAnnual;
    const variableComponents =
      mboPaid +
      oneOffPayment +
      incentiveAwards +
      liberalPayments +
      resultBonusPaid +
      variableAllowances +
      fringeBenefits;
    const totalSalary = baseSalary + totalAddOns;
    const totalSalaryFte = baseSalaryFte + totalAddOns;
    const variableComponentsFte = variableComponents;
    const structuralComponents = 0;
    const individualComponents = variableComponents;
    const livelloRetributivo = baseSalary;

    const firstName = textOrNull(raw.firstName);
    const lastName = textOrNull(raw.lastName);
    const composed = [firstName, lastName].filter(Boolean).join(" ");
    const name = composed || textOrNull(raw.name);
    const costCenterDescription = textOrNull(raw.costCenterDescription);
    const costCenterCode = textOrNull(raw.costCenterCode);
    const category = costCenterDescription || costCenterCode || textOrNull(raw.category);
    const performanceOnFive = raw.performanceOnFive ?? null;

    return new Employee({
      paySchema: "tea",
      index: raw.index,
      gender: raw.gender,
      employeeId: textOrNull(raw.employeeId),
      firstName,
      lastName,
      name,
      company: textOrNull(raw.company),
      qualification: textOrNull(raw.qualification),
      category,
      role: textOrNull(raw.role),
      level: textOrNull(raw.level),
      description: textOrNull(raw.description),
      seniority: raw.seniority ?? null,
      roleSeniority: raw.roleSeniority ?? null,
      performanceOnFive,
      performanceScore: performanceOnFive == null
        ? raw.performanceScore ?? null
        : Math.round((performanceOnFive / 5) * 1000) / 10,
      hireDate: raw.hireDate ?? null,
      terminationDate: raw.terminationDate ?? null,
      ccnl: raw.ccnl ?? null,
      ccnlMinimum,
      partTimePct,
      weeklyFullTimeHours: Number(raw.weeklyFullTimeHours) || 0,
      baseSalaryRaw: ral,
      superminimo,
      superminimoAssoluto,
      senioritySteps,
      forfaitOvertime,
      otherFixedItems,
      mboBase100,
      reportedHourly,
      bonusMbo: mboPaid,
      resultBonus,
      overtime,
      variableAllowances,
      oneOffPayment,
      fringeBenefits,
      companyWelfare,
      mealTicketAnnual,
      otherAnnual,
      incentiveAwards,
      liberalPayments,
      resultBonusPaid,
      baseSalary,
      structuralComponents,
      individualComponents,
      livelloRetributivo,
      totalSalary,
      variableComponents,
      structuralComponentsFte: 0,
      individualComponentsFte: variableComponentsFte,
      variableComponentsFte,
      baseSalaryFte,
      livelloRetributivoFte: baseSalaryFte,
      totalSalaryFte,
      baseSalaryHourly: toHourly(baseSalaryFte),
      livelloRetributivoHourly: toHourly(baseSalaryFte),
      totalSalaryHourly: toHourly(totalSalaryFte),
      variableComponentsHourly: toHourly(variableComponentsFte),
      jobCode: textOrNull(raw.jobCode),
      costCenterCode,
      costCenterDescription,
      softSkills: raw.softSkills ?? null,
      hardSkills: raw.hardSkills ?? null,
      grade: textOrNull(raw.grade),
      payBand: textOrNull(raw.payBand),
      jobFamily: textOrNull(raw.jobFamily),
      educationLevel: textOrNull(raw.educationLevel),
      hourlyAnnualHours: hours,
      ralDateProrated: false,
      monthlyAddedToRal: false,
    });
  }

  static fromJson(data: EmployeeJson): Employee {
    return new Employee(data);
  }

  toJSON(): EmployeeJson {
    return { ...this };
  }

  salaryField(
    metric: SalaryMetric,
    { fte = true, hourly = false } = {},
  ): string {
    if (metric === SALARY_METRICS.oraria) return "reportedHourly";
    if (metric === SALARY_METRICS.mbo) return "bonusMbo";
    if (metric === SALARY_METRICS.mboBase) return "mboBase100";
    const core = {
      [SALARY_METRICS.base]: "baseSalary",
      [SALARY_METRICS.livello]: "livelloRetributivo",
      [SALARY_METRICS.totale]: "totalSalary",
      [SALARY_METRICS.variabile]: "variableComponents",
    }[metric] || "baseSalary";
    if (hourly) return `${core}Hourly`;
    if (fte) {
      const fteMap: Record<string, string> = {
        baseSalary: "baseSalaryFte",
        livelloRetributivo: "livelloRetributivoFte",
        totalSalary: "totalSalaryFte",
        variableComponents: "variableComponentsFte",
      };
      return fteMap[core];
    }
    return core;
  }

  comparisonValue(
    metric: SalaryMetric,
    { fte = true, hourly = false } = {},
  ): number | null {
    if (metric === SALARY_METRICS.oraria) {
      return this.reportedHourly != null && this.reportedHourly > 0
        ? this.reportedHourly
        : null;
    }
    if (metric === SALARY_METRICS.mbo) {
      return this.bonusMbo > 0 ? this.bonusMbo : null;
    }
    if (metric === SALARY_METRICS.mboBase) {
      return this.mboBase100 > 0 ? this.mboBase100 : null;
    }
    const field = this.salaryField(metric, { fte, hourly });
    const v = this[field as keyof Employee];
    if (
      typeof v === "number" && Number.isFinite(v) && v > 0
    ) {
      return v;
    }
    if (hourly) {
      const annual = this.comparisonValue(metric, { fte, hourly: false });
      const hours = this.hourlyAnnualHours > 0
        ? this.hourlyAnnualHours
        : DEFAULT_ANNUAL_HOURS;
      return annual != null && annual > 0 ? annual / hours : null;
    }
    return null;
  }

  hasValidSalary(metric: SalaryMetric, { fte = true } = {}): boolean {
    if (metric === SALARY_METRICS.oraria) {
      return this.reportedHourly != null && this.reportedHourly > 0;
    }
    if (metric === SALARY_METRICS.mbo) return this.bonusMbo > 0;
    if (metric === SALARY_METRICS.mboBase) return this.mboBase100 > 0;
    const field = this.salaryField(metric, { fte });
    const v = this[field as keyof Employee];
    if (typeof v !== "number" || !Number.isFinite(v)) return false;
    return v > 0;
  }

  /** File hourly pay when present, otherwise the rate derived from annual pay. */
  hourlyPay(): number | null {
    if (this.reportedHourly != null && this.reportedHourly > 0) {
      return this.reportedHourly;
    }
    return Number.isFinite(this.baseSalaryHourly) && this.baseSalaryHourly > 0
      ? this.baseSalaryHourly
      : null;
  }
}

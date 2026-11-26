export type TeaPayLine = {
  label: string;
  amount: number;
  note?: string;
};

export type TeaPayComposition = {
  partTimePct: number;
  weeklyFullTimeHours: number;
  company: string | null;
  qualification: string | null;
  educationLevel: string | null;
  grade: string | null;
  payBand: string | null;
  jobFamily: string | null;
  jobCode: string | null;
  costCenterCode: string | null;
  softSkills: number | null;
  hardSkills: number | null;
  performanceOnFive: number | null;
  ral: number;
  ralFte: number;
  hourly: number;
  monthly: TeaPayLine[];
  monthlyTotal: number;
  annual: TeaPayLine[];
};

type TeaPerson = {
  paySchema?: string;
  ccnlMinimum?: number | null;
  superminimo?: number;
  superminimoAssoluto?: number;
  senioritySteps?: number;
  forfaitOvertime?: number;
  otherFixedItems?: number;
  partTimePct?: number;
  weeklyFullTimeHours?: number;
  company?: string | null;
  qualification?: string | null;
  educationLevel?: string | null;
  grade?: string | null;
  payBand?: string | null;
  jobFamily?: string | null;
  jobCode?: string | null;
  costCenterCode?: string | null;
  softSkills?: number | null;
  hardSkills?: number | null;
  performanceOnFive?: number | null;
  baseSalaryRaw?: number;
  baseSalary?: number;
  baseSalaryFte?: number;
  baseSalaryHourly?: number;
  reportedHourly?: number | null;
  mboBase100?: number;
  bonusMbo?: number;
  resultBonus?: number;
  overtime?: number;
  variableAllowances?: number;
  oneOffPayment?: number;
  fringeBenefits?: number;
  companyWelfare?: number;
};

/** Monthly lines on one side, annual lines on the other. Targets are marked as not paid. */
export function teaPayComposition(person: TeaPerson | null | undefined): TeaPayComposition | null {
  if (!person || person.paySchema !== "tea") return null;
  const monthly: TeaPayLine[] = [
    { label: "Minimo tabellare", amount: Number(person.ccnlMinimum) || 0 },
    { label: "Superminimo non assorbibile", amount: Number(person.superminimo) || 0 },
    { label: "Superminimo assorbibile", amount: Number(person.superminimoAssoluto) || 0 },
    { label: "Scatti di anzianità", amount: Number(person.senioritySteps) || 0 },
    { label: "Forfait straordinari", amount: Number(person.forfaitOvertime) || 0 },
    { label: "Altre voci fisse", amount: Number(person.otherFixedItems) || 0 },
  ];
  const monthlyTotal = monthly.reduce((sum, line) => sum + line.amount, 0);
  return {
    partTimePct: person.partTimePct ?? 100,
    weeklyFullTimeHours: person.weeklyFullTimeHours ?? 0,
    company: person.company ?? null,
    qualification: person.qualification ?? null,
    educationLevel: person.educationLevel ?? null,
    grade: person.grade ?? null,
    payBand: person.payBand ?? null,
    jobFamily: person.jobFamily ?? null,
    jobCode: person.jobCode ?? null,
    costCenterCode: person.costCenterCode ?? null,
    softSkills: person.softSkills ?? null,
    hardSkills: person.hardSkills ?? null,
    performanceOnFive: person.performanceOnFive ?? null,
    ral: person.baseSalaryRaw ?? person.baseSalary ?? 0,
    ralFte: person.baseSalaryFte ?? 0,
    hourly:
      person.reportedHourly != null && person.reportedHourly > 0
        ? person.reportedHourly
        : person.baseSalaryHourly ?? 0,
    monthly,
    monthlyTotal,
    annual: [
      { label: "Bonus / MBO target", amount: Number(person.mboBase100) || 0, note: "competenza, non erogato" },
      { label: "Bonus / MBO erogato", amount: Number(person.bonusMbo) || 0, note: "competenza precedente" },
      { label: "Premio di risultato base 100", amount: Number(person.resultBonus) || 0, note: "obiettivo, non erogato" },
      { label: "Straordinari", amount: Number(person.overtime) || 0, note: "annuo erogato" },
      { label: "Indennità variabili", amount: Number(person.variableAllowances) || 0, note: "annuo" },
      { label: "Una tantum", amount: Number(person.oneOffPayment) || 0, note: "annuo" },
      { label: "Fringe benefit", amount: Number(person.fringeBenefits) || 0, note: "annuo" },
      { label: "Welfare aziendale", amount: Number(person.companyWelfare) || 0, note: "annuo" },
    ],
  };
}

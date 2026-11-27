import { Employee } from "../models/Employee";
import { SALARY_METRICS, type SalaryMetric } from "../models/constants";

export const RGA_COMPONENTS = [
  { id: "ral", field: "baseSalaryFte", labelKey: "compensationPage.results.rga.ral", defaultOn: true },
  { id: "mboBase", field: "mboBase100", labelKey: "compensationPage.results.rga.mboBase", defaultOn: true },
  { id: "mboPaid", field: "bonusMbo", labelKey: "compensationPage.results.rga.mboPaid", defaultOn: false },
  { id: "pdr", field: "resultBonus", labelKey: "compensationPage.results.rga.pdr", defaultOn: true },
  { id: "pdrPaid", field: "resultBonusPaid", labelKey: "compensationPage.results.rga.pdrPaid", defaultOn: false },
  { id: "fringe", field: "fringeBenefits", labelKey: "compensationPage.results.rga.fringe", defaultOn: true },
  { id: "welfare", field: "companyWelfare", labelKey: "compensationPage.results.rga.welfare", defaultOn: true },
  { id: "meal", field: "mealTicketAnnual", labelKey: "compensationPage.results.rga.meal", defaultOn: true },
  { id: "overtime", field: "overtime", labelKey: "compensationPage.results.rga.overtime", defaultOn: false },
  { id: "allowances", field: "variableAllowances", labelKey: "compensationPage.results.rga.allowances", defaultOn: false },
  { id: "oneOff", field: "oneOffPayment", labelKey: "compensationPage.results.rga.oneOff", defaultOn: false },
  { id: "incentives", field: "incentiveAwards", labelKey: "compensationPage.results.rga.incentives", defaultOn: false },
  { id: "liberal", field: "liberalPayments", labelKey: "compensationPage.results.rga.liberal", defaultOn: false },
  { id: "other", field: "otherAnnual", labelKey: "compensationPage.results.rga.other", defaultOn: true },
] as const;

export type RgaComponentId = (typeof RGA_COMPONENTS)[number]["id"];

/** Italian names of the pay voices (translated where rendered). */
export const RGA_LABELS: Record<RgaComponentId, string> = {
  ral: "RAL a tempo pieno",
  mboBase: "MBO a target",
  mboPaid: "MBO erogato",
  pdr: "Premio di risultato a target",
  pdrPaid: "Premio di risultato erogato",
  fringe: "Fringe benefit",
  welfare: "Welfare aziendale",
  meal: "Buoni pasto",
  overtime: "Straordinari",
  allowances: "Indennità variabili",
  oneOff: "Una tantum",
  incentives: "Incentivi",
  liberal: "Erogazioni liberali",
  other: "Altre voci annue",
};
export type RgaSelection = Record<RgaComponentId, boolean>;

export function defaultRgaSelection(): RgaSelection {
  return RGA_COMPONENTS.reduce((selection, item) => {
    selection[item.id] = item.defaultOn;
    return selection;
  }, {} as RgaSelection);
}

function componentAmount(person: Employee, field: (typeof RGA_COMPONENTS)[number]["field"]): number {
  const value = Number(person[field]);
  return Number.isFinite(value) ? value : 0;
}

/** Sum of the RGA voices switched on. Only full-time RAL is already scaled. */
export function rgaAmount(person: Employee, selection: RgaSelection): number {
  if (person.paySchema !== "tea") return Number(person.totalSalaryFte) || 0;
  return RGA_COMPONENTS.reduce((sum, item) => {
    if (!selection[item.id]) return sum;
    return sum + componentAmount(person, item.field);
  }, 0);
}

/**
 * Pay of a person for a metric. With a selection of voices (Spark/TEA template): total = the voices
 * switched on; variable = the voices switched on except the RAL.
 */
export function personPay(
  person: Employee,
  metric: SalaryMetric,
  rga: RgaSelection | null = null
): number | null {
  if (metric === SALARY_METRICS.totale && rga) {
    const amount = rgaAmount(person, rga);
    return amount > 0 ? amount : null;
  }
  if (metric === SALARY_METRICS.variabile && rga && person.paySchema === "tea") {
    const amount = rgaAmount(person, { ...rga, ral: false });
    return amount > 0 ? amount : null;
  }
  return person.comparisonValue(metric, { fte: true });
}

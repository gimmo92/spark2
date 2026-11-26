import { COLUMN_ROLES, type ColumnMapping } from "../columnRoles";
import { Employee } from "../models/Employee";
import type { Gender } from "../models/constants";
import { SalaryMath } from "./SalaryMath";

function reportedHourly(row: unknown[], index: number | undefined): number | null {
  if (index == null || index < 0) return null;
  const value = row[index];
  if (value == null || value === "") return null;
  const amount = SalaryMath.parseNumber(value);
  return amount > 0 ? amount : null;
}

function cleanText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function normalizeStoredDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 20000 && value < 120000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  return s === "" ? null : s;
}

export class EmployeeNormalizer {
  static normalizeGender(raw: unknown): Gender | null {
    if (raw == null || raw === "") return null;
    const s = String(raw).trim().toLowerCase();
    if (
      s === "m" ||
      s === "maschio" ||
      s === "maschile" ||
      s === "male" ||
      s === "uomo" ||
      s === "u" ||
      s === "h" ||
      s === "homme"
    ) {
      return "M";
    }
    if (
      s === "f" ||
      s === "femmina" ||
      s === "femminile" ||
      s === "female" ||
      s === "donna" ||
      s === "d" ||
      s === "femme"
    ) {
      return "F";
    }
    const first = s.charAt(0);
    if (first === "m" || first === "u" || first === "h") return "M";
    if (first === "f" || first === "d") return "F";
    return null;
  }

  static parsePerformanceScore(value: unknown): number | null {
    return SalaryMath.parseScoreOnFive(value);
  }

  static fromWorkbook(
    rows: unknown[][],
    headers: unknown[],
    mapping: ColumnMapping
  ): Employee[] {
    if (!rows?.length || !headers?.length || !mapping) return [];

    const idx = (key: string) =>
      Object.prototype.hasOwnProperty.call(mapping, key)
        ? mapping[key as keyof ColumnMapping]
        : undefined;

    const cell = (row: unknown[], i: number | undefined) =>
      i != null && i >= 0 ? row[i] : null;

    const num = (row: unknown[], key: string) => {
      const value = cell(row, idx(key));
      if (value == null || value === "") return 0;
      return SalaryMath.parseNumber(value);
    };
    const text = (row: unknown[], key: string) => cleanText(cell(row, idx(key)));

    return rows
      .map((row, rowIndex) => {
        const gender = EmployeeNormalizer.normalizeGender(
          cell(row, idx(COLUMN_ROLES.gender))
        );
        if (gender !== "M" && gender !== "F") return null;
        const ccnlVal = cell(row, idx(COLUMN_ROLES.ccnl));
        const weekly = num(row, COLUMN_ROLES.weeklyFullTimeHours);
        return Employee.fromTeaRecord({
          index: rowIndex + 1,
          gender,
          employeeId: text(row, COLUMN_ROLES.employeeId),
          firstName: text(row, COLUMN_ROLES.firstName),
          lastName: text(row, COLUMN_ROLES.lastName),
          name: text(row, COLUMN_ROLES.employeeName),
          company: text(row, COLUMN_ROLES.company),
          qualification: text(row, COLUMN_ROLES.qualification),
          category: text(row, COLUMN_ROLES.category),
          role: text(row, COLUMN_ROLES.role),
          level: text(row, COLUMN_ROLES.level),
          description: text(row, COLUMN_ROLES.description),
          seniority: cell(row, idx(COLUMN_ROLES.seniority)),
          roleSeniority: cell(row, idx(COLUMN_ROLES.roleSeniority)),
          performanceOnFive: SalaryMath.parseScoreOnFive(
            cell(row, idx(COLUMN_ROLES.performanceScore))
          ),
          hireDate: normalizeStoredDate(cell(row, idx(COLUMN_ROLES.hireDate))),
          terminationDate: normalizeStoredDate(
            cell(row, idx(COLUMN_ROLES.terminationDate))
          ),
          ccnl:
            ccnlVal != null && String(ccnlVal).trim() !== ""
              ? String(ccnlVal).trim()
              : null,
          ccnlMinimum: idx(COLUMN_ROLES.ccnlMinimum) != null
            ? num(row, COLUMN_ROLES.ccnlMinimum)
            : null,
          partTimePct: idx(COLUMN_ROLES.partTimePct) != null
            ? SalaryMath.parsePartTimePct(cell(row, idx(COLUMN_ROLES.partTimePct)))
            : 100,
          weeklyFullTimeHours: weekly,
          baseSalary: num(row, COLUMN_ROLES.baseSalary),
          superminimo: num(row, COLUMN_ROLES.superminimo),
          superminimoAssoluto: num(row, COLUMN_ROLES.superminimoAssoluto),
          senioritySteps: num(row, COLUMN_ROLES.senioritySteps),
          otherFixedItems: num(row, COLUMN_ROLES.otherFixedItems),
          forfaitOvertime: num(row, COLUMN_ROLES.forfaitOvertime),
          reportedHourly: reportedHourly(row, idx(COLUMN_ROLES.reportedHourly)),
          mboBase100: num(row, COLUMN_ROLES.mboBase100),
          bonusMbo: num(row, COLUMN_ROLES.bonusMbo),
          resultBonus: num(row, COLUMN_ROLES.resultBonus),
          overtime: num(row, COLUMN_ROLES.overtime),
          variableAllowances: num(row, COLUMN_ROLES.variableAllowances),
          oneOffPayment: num(row, COLUMN_ROLES.oneOffPayment),
          fringeBenefits: num(row, COLUMN_ROLES.fringeBenefits),
          companyWelfare: num(row, COLUMN_ROLES.companyWelfare),
          mealTicketAnnual: num(row, COLUMN_ROLES.mealTicketAnnual),
          otherAnnual: num(row, COLUMN_ROLES.otherAnnual),
          incentiveAwards: num(row, COLUMN_ROLES.incentiveAwards),
          liberalPayments: num(row, COLUMN_ROLES.liberalPayments),
          resultBonusPaid: num(row, COLUMN_ROLES.resultBonusPaid),
          jobCode: text(row, COLUMN_ROLES.jobCode),
          costCenterCode: text(row, COLUMN_ROLES.costCenterCode),
          costCenterDescription: text(row, COLUMN_ROLES.costCenterDescription),
          softSkills: SalaryMath.parseScoreOnFive(
            cell(row, idx(COLUMN_ROLES.softSkills))
          ),
          hardSkills: SalaryMath.parseScoreOnFive(
            cell(row, idx(COLUMN_ROLES.hardSkills))
          ),
          grade: text(row, COLUMN_ROLES.grade),
          payBand: text(row, COLUMN_ROLES.payBand),
          jobFamily: text(row, COLUMN_ROLES.jobFamily),
          educationLevel: text(row, COLUMN_ROLES.educationLevel),
        });
      })
      .filter((e): e is Employee => e != null);
  }
}

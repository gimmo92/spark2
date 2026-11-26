import {
  COLUMN_ROLES,
  isMappingRoleAssigned,
  MAPPING_UI_SECTIONS,
  type ColumnMapping,
  type ColumnRole,
} from "./columnRoles";
import { countNonEmptyRows } from "./parseWorkbook";

export type DummyGenderCounts = {
  male: number;
  female: number;
  other: number;
};

export type DummyMappedField = {
  role: ColumnRole;
  header: string | null;
  mapped: boolean;
};

export type DummyAnalysisResult = {
  isPlaceholder: true;
  employeeCount: number;
  gender: DummyGenderCounts;
  mappedFields: DummyMappedField[];
  placeholderGapPct: null;
};

export function normalizeGender(raw: unknown): "M" | "F" | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim().toLowerCase();
  if (
    s === "m" ||
    s === "maschio" ||
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

function cellAt(row: unknown[], index: number | undefined): unknown {
  if (index == null || index < 0 || !Array.isArray(row)) return null;
  return row[index];
}

export function computeDummyAnalysis(
  rows: unknown[][],
  headers: unknown[],
  mapping: ColumnMapping
): DummyAnalysisResult {
  const genderIdx = mapping[COLUMN_ROLES.gender];
  const gender: DummyGenderCounts = { male: 0, female: 0, other: 0 };
  const dataRows = (rows || []).filter(
    (row) => Array.isArray(row) && row.some((c) => c != null && String(c).trim() !== "")
  );

  for (const row of dataRows) {
    const g = normalizeGender(cellAt(row, genderIdx));
    if (g === "M") gender.male += 1;
    else if (g === "F") gender.female += 1;
    else gender.other += 1;
  }

  const mappedFields: DummyMappedField[] = MAPPING_UI_SECTIONS.flatMap(
    (section) => section.fields
  ).map(
    ({ role }) => {
      const mapped = isMappingRoleAssigned(mapping, role);
      const idx = mapping[role];
      const header =
        mapped && idx != null && headers[idx] != null
          ? String(headers[idx]).trim()
          : null;
      return { role, header, mapped };
    }
  );

  return {
    isPlaceholder: true,
    employeeCount: countNonEmptyRows(rows),
    gender,
    mappedFields,
    placeholderGapPct: null,
  };
}

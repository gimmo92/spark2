export { COLUMN_ROLES, type ColumnMapping, type ColumnRole } from "./columnRoles";
export { Employee, type EmployeeJson } from "./models/Employee";
export {
  DEFAULT_ANNUAL_HOURS,
  EU_GAP_THRESHOLD_PCT,
  MIN_GENDER_SAMPLE,
  SALARY_METRICS,
  type Gender,
  type SalaryMetric,
} from "./models/constants";
export { SalaryMath } from "./analysis/SalaryMath";
export { EmployeeNormalizer } from "./analysis/EmployeeNormalizer";
export { LevelTaxonomy } from "./analysis/LevelTaxonomy";
export { JobGradingAnalyzer } from "./analysis/JobGradingAnalyzer";
export { OutlierCalculator } from "./analysis/OutlierCalculator";
export {
  ANALYSIS_SNAPSHOT_KIND,
  ANALYSIS_SNAPSHOT_KIND_V1,
  AnalysisFormatters,
  CompensationAnalysis,
  type AnalysisSnapshot,
} from "./analysis/CompensationAnalysis";
export { matchTeaHeaders, isTeaTracciato, checkSchema, TEA_EXPECTED_HEADERS } from "./provaTrasparenzaAdapter";

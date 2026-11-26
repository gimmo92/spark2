// @spark/transparency: pay transparency module (EU directive 2023/970). Client apps use it as is or replace single screens.
export * from "./module";
export * from "./store";
export * from "./components/TransparencyPage";
export * from "./components/Results";
export * from "./components/EmployeePanel";
export * from "./components/RoleWeights";
export * from "./components/JobGradingPage";
export * from "./components/BenchmarkPage";
export type { BenchmarkDoc, BenchmarkStats } from "./lib/benchmark";
export { CRITERIA, roleScore, type RoleWeightDoc, type RoleScores } from "./lib/roleWeights";
export { CompensationAnalysis, type AnalysisSnapshot, type SavedJustification as PayJustification } from "./lib/analysis/CompensationAnalysis";

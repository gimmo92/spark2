// @spark/transparency: pay transparency module (EU directive 2023/970). Client apps use it as is or replace single screens.
export * from "./module";
export * from "./store";
export * from "./components/TransparencyPage";
export * from "./components/Results";
export * from "./components/EmployeePanel";
export { CompensationAnalysis, type AnalysisSnapshot, type SavedJustification as PayJustification } from "./lib/analysis/CompensationAnalysis";

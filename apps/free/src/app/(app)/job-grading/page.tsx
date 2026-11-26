import type { Metadata } from "next";
import { JobGradingPage } from "@spark/transparency";

export const metadata: Metadata = { title: "Job grading · Spark" };

export default function JobGradingRoute() {
  return <JobGradingPage />;
}

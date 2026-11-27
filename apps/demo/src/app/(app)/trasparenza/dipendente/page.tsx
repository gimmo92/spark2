import type { Metadata } from "next";
import { Suspense } from "react";
import { EmployeePage } from "@spark/transparency";

export const metadata: Metadata = { title: "Dipendente · Spark" };

// the analysis and the employee are read from the URL on the client
export default function EmployeeRoute() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <EmployeePage />
    </Suspense>
  );
}

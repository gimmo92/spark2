import type { Metadata } from "next";
import { Suspense } from "react";
import { SalaryBandsPage } from "@spark/transparency";

export const metadata: Metadata = { title: "Salary bands · Spark" };

// the data shown is read from the URL on the client
export default function SalaryBandsRoute() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <SalaryBandsPage />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { BenchmarkPage } from "@spark/transparency";

export const metadata: Metadata = { title: "Benchmarks · Spark" };

// tab and data are read from the URL on the client
export default function BenchmarksRoute() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <BenchmarkPage />
    </Suspense>
  );
}

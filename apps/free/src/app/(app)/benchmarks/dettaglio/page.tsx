import type { Metadata } from "next";
import { Suspense } from "react";
import { BenchmarkDetailPage } from "@spark/transparency";

export const metadata: Metadata = { title: "Benchmark · Spark" };

// the analysis and the role are read from the URL on the client
export default function BenchmarkDetailRoute() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <BenchmarkDetailPage />
    </Suspense>
  );
}

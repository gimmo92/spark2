import type { Metadata } from "next";
import { BenchmarkPage } from "@spark/transparency";

export const metadata: Metadata = { title: "Benchmarks · Spark" };

export default function BenchmarksRoute() {
  return <BenchmarkPage />;
}

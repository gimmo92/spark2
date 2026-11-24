import { Suspense } from "react";
import type { Metadata } from "next";
import { IncentivePlanSheet } from "@/components/IncentivePlanSheet";

export const metadata: Metadata = { title: "Incentive Plan · Spark" };

// Schede live in the client store, so the id is read on the client.
export default function SchedaCalcoloPage() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <IncentivePlanSheet />
    </Suspense>
  );
}

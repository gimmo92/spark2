import type { Metadata } from "next";
import { Suspense } from "react";
import { CcnlPage } from "@spark/transparency";

export const metadata: Metadata = { title: "Minimi CCNL · Spark" };

// the data shown is read from the URL on the client
export default function CcnlRoute() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <CcnlPage />
    </Suspense>
  );
}

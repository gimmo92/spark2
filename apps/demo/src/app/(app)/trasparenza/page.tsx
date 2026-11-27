import type { Metadata } from "next";
import { Suspense } from "react";
import { TransparencyPage } from "@spark/transparency";

export const metadata: Metadata = { title: "Trasparenza retributiva · Spark" };

// the open analysis and view are read from the URL on the client
export default function TrasparenzaPage() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <TransparencyPage />
    </Suspense>
  );
}

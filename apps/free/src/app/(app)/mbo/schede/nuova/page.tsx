import type { Metadata } from "next";
import { Suspense } from "react";
import { SchedaEditorPage } from "@spark/mbo";

export const metadata: Metadata = { title: "Nuova scheda · Spark" };

export default function NewSchedaPage() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <SchedaEditorPage isNew />
    </Suspense>
  );
}

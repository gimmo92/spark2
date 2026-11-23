import type { Metadata } from "next";
import { Suspense } from "react";
import { ObiettivoEditorPage } from "@spark/mbo";

export const metadata: Metadata = { title: "Nuovo obiettivo · Spark" };

export default function NewObiettivoPage() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <ObiettivoEditorPage isNew />
    </Suspense>
  );
}

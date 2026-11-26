import { Suspense } from "react";
import { ObiettivoEditorPage } from "@spark/mbo";

// Objectives live in the client store, so the id is read on the client.
export default function EditObiettivoPage() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <ObiettivoEditorPage />
    </Suspense>
  );
}

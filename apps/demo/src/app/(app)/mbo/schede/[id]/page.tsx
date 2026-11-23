import { Suspense } from "react";
import { SchedaEditorPage } from "@spark/mbo";

// Schede live in the client store, so the id is read on the client.
export default function EditSchedaPage() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <SchedaEditorPage />
    </Suspense>
  );
}

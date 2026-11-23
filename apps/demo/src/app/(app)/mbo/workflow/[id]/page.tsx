import { Suspense } from "react";
import { WorkflowEditorPage } from "@spark/mbo";

// Workflows live in the client store, so the id is read on the client.
export default function EditWorkflowPage() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <WorkflowEditorPage />
    </Suspense>
  );
}

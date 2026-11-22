import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkflowEditorPage } from "@/components/WorkflowEditor";

export const metadata: Metadata = { title: "Nuovo workflow · Spark" };

export default function NewWorkflowPage() {
  return (
    <Suspense fallback={<div className="card h-40 animate-pulse" />}>
      <WorkflowEditorPage isNew />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { WorkflowList } from "@/components/WorkflowList";

export const metadata: Metadata = { title: "Workflow · Spark" };

export default function WorkflowPage() {
  return <WorkflowList />;
}

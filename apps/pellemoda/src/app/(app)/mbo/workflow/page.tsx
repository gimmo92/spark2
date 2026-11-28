import type { Metadata } from "next";
import { WorkflowList } from "@spark/mbo";

export const metadata: Metadata = { title: "Workflow · Spark" };

export default function WorkflowPage() {
  return <WorkflowList />;
}

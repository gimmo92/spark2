import type { Metadata } from "next";
import { Dashboard } from "@spark/core";

export const metadata: Metadata = { title: "Dashboard · Spark" };

export default function DashboardPage() {
  return <Dashboard />;
}

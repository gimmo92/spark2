import type { Metadata } from "next";
import { DashboardMbo } from "@/components/DashboardMbo";

export const metadata: Metadata = { title: "Dashboard MBO · Spark" };

export default function DashboardMboPage() {
  return <DashboardMbo />;
}

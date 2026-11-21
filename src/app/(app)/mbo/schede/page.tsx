import type { Metadata } from "next";
import { SchedeTable } from "@/components/SchedeTable";

export const metadata: Metadata = { title: "Schede obiettivo · Spark" };

export default function SchedePage() {
  return <SchedeTable />;
}

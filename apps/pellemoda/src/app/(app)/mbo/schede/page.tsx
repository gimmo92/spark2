import type { Metadata } from "next";
import { SchedeTable } from "@spark/mbo";

export const metadata: Metadata = { title: "Schede obiettivo · Spark" };

export default function SchedePage() {
  return <SchedeTable />;
}

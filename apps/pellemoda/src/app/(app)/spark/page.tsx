import type { Metadata } from "next";
import { SparkPanel } from "@spark/core";

export const metadata: Metadata = { title: "Pannello Spark · Spark" };

export default function SparkPanelPage() {
  return <SparkPanel />;
}

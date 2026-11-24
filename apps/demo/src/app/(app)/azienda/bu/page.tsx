import type { Metadata } from "next";
import { BusinessUnitsGrid } from "@spark/core";

export const metadata: Metadata = { title: "Business Unit · Spark" };

export default function BusinessUnitPage() {
  return <BusinessUnitsGrid />;
}

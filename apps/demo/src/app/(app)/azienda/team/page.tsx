import type { Metadata } from "next";
import { TeamsGrid } from "@spark/core";

export const metadata: Metadata = { title: "Lista Team · Spark" };

export default function TeamPage() {
  return <TeamsGrid />;
}

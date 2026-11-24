import type { Metadata } from "next";
import { RolesList } from "@spark/core";

export const metadata: Metadata = { title: "Lista Ruoli · Spark" };

export default function RuoliPage() {
  return <RolesList />;
}

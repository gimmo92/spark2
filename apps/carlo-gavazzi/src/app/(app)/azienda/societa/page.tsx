import type { Metadata } from "next";
import { CompaniesList } from "@spark/core";

export const metadata: Metadata = { title: "Lista Società · Spark" };

export default function SocietaPage() {
  return <CompaniesList />;
}

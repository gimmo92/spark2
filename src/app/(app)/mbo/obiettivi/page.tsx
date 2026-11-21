import type { Metadata } from "next";
import { ObiettiviTable } from "@/components/ObiettiviTable";

export const metadata: Metadata = { title: "Obiettivi · Spark" };

export default function ObiettiviPage() {
  return <ObiettiviTable />;
}

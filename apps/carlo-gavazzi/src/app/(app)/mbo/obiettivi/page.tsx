import type { Metadata } from "next";
import { ObiettiviTable } from "@spark/mbo";

export const metadata: Metadata = { title: "Obiettivi · Spark" };

export default function ObiettiviPage() {
  return <ObiettiviTable />;
}

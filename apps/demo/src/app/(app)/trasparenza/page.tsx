import type { Metadata } from "next";
import { TransparencyPage } from "@spark/transparency";

export const metadata: Metadata = { title: "Trasparenza retributiva · Spark" };

export default function TrasparenzaPage() {
  return <TransparencyPage />;
}

import type { Metadata } from "next";
import { DataUploadPage } from "@spark/transparency";

export const metadata: Metadata = { title: "Caricamento dati · Spark" };

export default function DataUploadRoute() {
  return <DataUploadPage />;
}

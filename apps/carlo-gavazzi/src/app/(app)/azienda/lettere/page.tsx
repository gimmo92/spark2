import type { Metadata } from "next";
import { LettersPage } from "@spark/core";

export const metadata: Metadata = { title: "Gestione Lettere · Spark" };

export default function LetterePage() {
  return <LettersPage />;
}

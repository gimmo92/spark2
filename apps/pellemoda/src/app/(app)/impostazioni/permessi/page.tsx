import type { Metadata } from "next";
import { AccessSettings } from "@spark/core";

export const metadata: Metadata = { title: "Permessi · Spark" };

export default function SettingsPermessiPage() {
  return <AccessSettings />;
}

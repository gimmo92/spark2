import type { Metadata } from "next";
import { SettingsMbo } from "@/components/SettingsMbo";

export const metadata: Metadata = { title: "Impostazioni MBO · Spark" };

export default function SettingsMboPage() {
  return <SettingsMbo />;
}

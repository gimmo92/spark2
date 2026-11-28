import type { Metadata } from "next";
import { MyProfile } from "@spark/core";

export const metadata: Metadata = { title: "Profilo · Spark" };

export default function ProfiloPage() {
  return <MyProfile />;
}

import type { Metadata } from "next";
import { UsersTable } from "@/components/UsersTable";

export const metadata: Metadata = { title: "Lista Utenti · Spark" };

export default function UsersPage() {
  return <UsersTable />;
}

import type { Metadata } from "next";
import { UpdatePasswordForm } from "@spark/core";

export const metadata: Metadata = { title: "Imposta password · Spark" };

export default function UpdatePasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <UpdatePasswordForm />
    </main>
  );
}

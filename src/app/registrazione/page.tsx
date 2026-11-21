import type { Metadata } from "next";
import { RegisterForm } from "@/components/RegisterForm";

export const metadata: Metadata = { title: "Registrazione · Spark" };

export default function RegistrazionePage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <RegisterForm />
    </main>
  );
}

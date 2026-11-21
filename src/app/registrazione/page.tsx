import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/RegisterForm";

export const metadata: Metadata = { title: "Registrazione · Spark" };

export default function RegistrazionePage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Suspense fallback={<div className="card h-[480px] w-full max-w-[400px] animate-pulse" />}>
        <RegisterForm />
      </Suspense>
    </main>
  );
}

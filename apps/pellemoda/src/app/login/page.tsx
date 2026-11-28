import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@spark/core";

export const metadata: Metadata = { title: "Accedi · Spark" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <Suspense fallback={<div className="card h-[420px] w-full max-w-[400px] animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}

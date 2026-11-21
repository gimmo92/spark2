import { Suspense } from "react";
import { UserDetail } from "@/components/UserDetail";

// Users live in the client store (localStorage), so the id is read on the client.
export default function UserPage() {
  return (
    <Suspense fallback={<div className="card h-32 animate-pulse" />}>
      <UserDetail />
    </Suspense>
  );
}

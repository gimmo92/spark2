"use client";

import { AppShell } from "@spark/core";
import config from "@/spark.config";

/** Hands this app's config to the core shell (the config holds functions, so it's imported on the client). */
export function Providers({ children }: { children: React.ReactNode }) {
  return <AppShell config={config}>{children}</AppShell>;
}

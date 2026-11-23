"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { DatabaseZap, Menu, X } from "lucide-react";
import { Sidebar, SparkLogo } from "./Sidebar";
import type { SparkConfig } from "../config";
import { SparkProvider, useCore } from "./SparkProvider";

function Toasts() {
  const { toasts } = useCore();
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="animate-dialog rounded-xl bg-ink px-4 py-2.5 text-[12.5px] font-semibold text-white shadow-lg"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

function DataBanner() {
  const { dataSource, dataMessage } = useCore();
  if (dataSource !== "local" || !dataMessage) return null;
  return (
    <div role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] font-semibold text-amber-900">
      <DatabaseZap className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{dataMessage}</span>
      <Link href="/login?next=/" className="shrink-0 rounded-lg px-2 py-1 text-amber-900 underline hover:bg-amber-100">
        Accedi
      </Link>
    </div>
  );
}

/** Authenticated app frame: sidebar, data banner, toasts. Rendered by each app's (app)/layout via a client wrapper. */
export function AppShell({ config, children }: { config: SparkConfig; children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  return (
    <SparkProvider config={config}>
      <div className="flex min-h-screen">
        {/* desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 p-3 pr-0 lg:block">
          <div className="card h-full overflow-hidden !rounded-2xl">
            <Suspense fallback={null}>
              <Sidebar />
            </Suspense>
          </div>
        </aside>

        {/* mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="animate-fade absolute inset-0 bg-ink/30" onClick={() => setDrawer(false)} />
            <div className="animate-pop absolute inset-y-0 left-0 w-[240px] bg-white shadow-xl">
              <button
                type="button"
                aria-label="Chiudi menu"
                onClick={() => setDrawer(false)}
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-canvas"
              >
                <X className="h-5 w-5" />
              </button>
              <Suspense fallback={null}>
                <Sidebar onNavigate={() => setDrawer(false)} />
              </Suspense>
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <header className="flex items-center gap-3 px-4 pt-4 lg:hidden">
            <button
              type="button"
              aria-label="Apri menu"
              onClick={() => setDrawer(true)}
              className="card grid h-10 w-10 place-items-center"
            >
              <Menu className="h-5 w-5" />
            </button>
            <SparkLogo className="h-6 w-5" />
            <span className="font-semibold">{config.appName}</span>
          </header>
          <main className="px-4 py-5 lg:px-6 lg:py-4">
            <DataBanner />
            {children}
          </main>
        </div>
      </div>
      <Toasts />
    </SparkProvider>
  );
}

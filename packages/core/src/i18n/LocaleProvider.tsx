"use client";

import { createContext, Fragment, useContext, useEffect, useSyncExternalStore } from "react";
import { LOCALES, setActiveLocale, tr, type Locale } from "./i18n";

const KEY = "spark.locale";
const listeners = new Set<() => void>();
let preferred: Locale | null | undefined;

const isLocale = (v: unknown): v is Locale => LOCALES.some((l) => l.id === v);

function readPreferred(): Locale | null {
  if (preferred !== undefined) return preferred;
  try {
    const v = localStorage.getItem(KEY);
    preferred = isLocale(v) ? v : null;
  } catch {
    preferred = null;
  }
  return preferred;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    preferred = isLocale(e.newValue) ? e.newValue : null;
    fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** Change the UI language (saved in this browser). */
export function setLocale(l: Locale) {
  preferred = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // private mode: the choice lasts for this page only
  }
  listeners.forEach((f) => f());
}

const Ctx = createContext<Locale>("it");

/** The language the UI is rendered in. */
export const useLocale = () => useContext(Ctx);

/**
 * Renders its children in the user's language (saved choice, else `defaultLocale`).
 * The server and the first client render use `defaultLocale` (no hydration mismatch); switching
 * language remounts the subtree so every `tr()` re-runs. Keep it below the data store.
 */
export function LocaleProvider({ defaultLocale = "it", children }: { defaultLocale?: Locale; children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribe,
    () => readPreferred() ?? defaultLocale,
    () => defaultLocale,
  );
  setActiveLocale(locale);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <Ctx.Provider value={locale}>
      <Fragment key={locale}>{children}</Fragment>
    </Ctx.Provider>
  );
}

/** IT | EN switch. */
export function LocaleSwitch({ className = "" }: { className?: string }) {
  const locale = useLocale();
  return (
    <div role="group" aria-label={tr("Lingua")} className={`inline-flex rounded-lg border border-line bg-white p-0.5 ${className}`}>
      {LOCALES.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => setLocale(l.id)}
          aria-pressed={locale === l.id}
          aria-label={l.label}
          className={`rounded-md px-1.5 py-[2px] text-[10.5px] font-bold transition-colors ${
            locale === l.id ? "bg-brand-soft text-brand" : "text-muted hover:text-ink"
          }`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

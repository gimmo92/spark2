"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Tooltip } from "./ui";
import {
  ChartColumn,
  ChevronDown,
  Info,
  LogOut,
  Target,
  User,
  BookOpen,
  Star,
  Goal,
  Settings,
  type LucideIcon,
} from "lucide-react";

type Leaf = { label: string; href: string; badge?: string };
type Item =
  | { label: string; href: string; icon: LucideIcon; muted?: boolean }
  | { label: string; icon: LucideIcon; children: Leaf[]; id: string };

export const NAV: Item[] = [
  { label: "Profilo", href: "/profilo", icon: Info },
  { label: "Dashboard", href: "/dashboard", icon: ChartColumn },
  {
    id: "azienda",
    label: "La mia azienda",
    icon: User,
    children: [
      { label: "Lista Utenti", href: "/azienda/utenti" },
      { label: "Lista Team", href: "/azienda/team" },
      { label: "Modifica azienda", href: "/azienda/modifica" },
      { label: "Gestione Società", href: "/azienda/societa" },
      { label: "Gestione Ruoli", href: "/azienda/ruoli" },
      { label: "Organigramma", href: "/azienda/organigramma" },
      { label: "Gestione Lettere", href: "/azienda/lettere", badge: "Beta" },
    ],
  },
  {
    id: "mbo",
    label: "MBO",
    icon: Target,
    children: [
      { label: "Schede obiettivo", href: "/mbo/schede" },
      { label: "Obiettivi", href: "/mbo/obiettivi" },
      { label: "Workflow", href: "/mbo/workflow" },
      { label: "Forecast", href: "/mbo/forecast" },
    ],
  },
  { label: "Competenze", href: "/competenze", icon: BookOpen, muted: true },
  { label: "Valutazioni", href: "/valutazioni", icon: Star, muted: true },
  { label: "OKR", href: "/okr", icon: Goal, muted: true },
  { label: "Impostazioni", href: "/impostazioni", icon: Settings },
];

export function SparkLogo({ className = "" }: { className?: string }) {
  const gid = useId();
  return (
    <svg viewBox="0 0 24 32" fill="none" className={className} aria-hidden>
      <path
        d="M15.5 1.5 4 18.2h7.4L8.5 30.5 20 13.8h-7.4L15.5 1.5Z"
        stroke={`url(#${gid})`}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id={gid} x1="4" y1="2" x2="20" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22c3f5" />
          <stop offset="1" stopColor="#1e5fe0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({
    azienda: pathname.startsWith("/azienda"),
    mbo: pathname.startsWith("/mbo"),
  }));

  return (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-line px-6 pb-4 pt-5">
        <SparkLogo className="h-6 w-[18px]" />
        <span className="text-[14px] font-semibold tracking-tight text-ink">Spark</span>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto pb-6">
        <p className="px-6 pb-2 pt-5 text-[11px] font-bold uppercase tracking-wide text-[#3d8be8]">Sezioni</p>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            if ("children" in item) {
              const isOpen = !!open[item.id];
              const childActive = item.children.some((c) => pathname.startsWith(c.href));
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [item.id]: !o[item.id] }))}
                    aria-expanded={isOpen}
                    className={`flex w-full items-center gap-3 rounded-r-xl px-6 py-2.5 text-left text-[13px] transition-colors ${
                      childActive || isOpen ? "bg-[#f6f8fb] font-semibold text-ink" : "text-ink/85 hover:bg-[#f8f9fb]"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 text-[#7d8698]" strokeWidth={1.4} />
                    <span className="flex-1">{item.label}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 fill-current text-ink/70 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <div className="overflow-hidden" inert={!isOpen}>
                      <ul className="py-1">
                        {item.children.map((c) => {
                          const active = pathname.startsWith(c.href);
                          return (
                            <li key={c.href}>
                              <Link
                                href={c.href}
                                onClick={onNavigate}
                                className={`flex items-center gap-4 py-1.5 pl-[34px] pr-4 text-[13px] transition-colors ${
                                  active ? "font-semibold text-ink" : "text-muted hover:text-ink"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${active ? "scale-125 bg-ink" : "bg-faint"}`}
                                />
                                <span className="flex-1 whitespace-nowrap">{c.label}</span>
                                {c.badge && (
                                  <span className="rounded bg-[#20a8ef] px-1.5 py-[1px] text-[11px] font-bold text-white">
                                    {c.badge}
                                  </span>
                                )}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </li>
              );
            }
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-r-xl px-6 py-2.5 text-[13px] transition-colors ${
                    active ? "bg-[#f6f8fb] font-semibold text-ink" : item.muted ? "text-faint hover:text-muted" : "text-ink/85 hover:bg-[#f8f9fb]"
                  }`}
                >
                  <Icon
                    className={`h-[18px] w-[18px] shrink-0 ${item.muted && !active ? "text-[#c3c8d1]" : "text-[#7d8698]"}`}
                    strokeWidth={1.4}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <AccountFooter />
    </nav>
  );
}

/** Signed-in user (from Supabase) + logout. Falls back to a demo identity when auth isn't configured. */
function AccountFooter() {
  const [who, setWho] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!alive || !u) return;
      const meta = (u.user_metadata ?? {}) as Record<string, string | undefined>;
      setWho({ name: meta.full_name ?? meta.name ?? u.email?.split("@")[0] ?? "Utente", email: u.email ?? "" });
    });
    return () => {
      alive = false;
    };
  }, []);

  const name = who?.name ?? "Amministratore";
  const initials = name
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <div className="border-t border-line px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand">{initials || "U"}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold">{name}</p>
          <p className="truncate text-[11px] text-muted">{who?.email || "Valmec S.p.A."}</p>
        </div>
        <form action="/auth/signout" method="post">
          <Tooltip label="Esci">
            <button
              type="submit"
              aria-label="Esci"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </Tooltip>
        </form>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
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
      { label: "Obiettivi", href: "/mbo/obiettivi" },
      { label: "Schede MBO", href: "/mbo/schede" },
      { label: "Consuntivazione", href: "/mbo/consuntivazione" },
    ],
  },
  { label: "Competenze", href: "/competenze", icon: BookOpen, muted: true },
  { label: "Valutazioni", href: "/valutazioni", icon: Star, muted: true },
  { label: "OKR", href: "/okr", icon: Goal, muted: true },
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
      <div className="flex items-center gap-2.5 border-b border-line px-9 pb-7 pt-8">
        <SparkLogo className="h-8 w-6" />
        <span className="text-[17px] font-semibold tracking-tight text-ink">Spark</span>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto pb-6">
        <p className="px-9 pb-3 pt-9 text-[12px] font-bold uppercase tracking-wide text-[#3d8be8]">Sezioni</p>
        <ul className="space-y-1">
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
                    className={`flex w-full items-center gap-4 rounded-r-xl px-9 py-4 text-left text-[16px] transition-colors ${
                      childActive || isOpen ? "bg-[#f6f8fb] font-semibold text-ink" : "text-ink/85 hover:bg-[#f8f9fb]"
                    }`}
                  >
                    <Icon className="h-[22px] w-[22px] shrink-0 text-[#7d8698]" strokeWidth={1.4} />
                    <span className="flex-1">{item.label}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 fill-current text-ink/70 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <div className="overflow-hidden" inert={!isOpen}>
                      <ul className="py-2">
                        {item.children.map((c) => {
                          const active = pathname.startsWith(c.href);
                          return (
                            <li key={c.href}>
                              <Link
                                href={c.href}
                                onClick={onNavigate}
                                className={`flex items-center gap-5 py-2.5 pl-[50px] pr-5 text-[15px] transition-colors ${
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
                  className={`flex items-center gap-4 rounded-r-xl px-9 py-4 text-[16px] transition-colors ${
                    active ? "bg-[#f6f8fb] font-semibold text-ink" : item.muted ? "text-faint hover:text-muted" : "text-ink/85 hover:bg-[#f8f9fb]"
                  }`}
                >
                  <Icon
                    className={`h-[22px] w-[22px] shrink-0 ${item.muted && !active ? "text-[#c3c8d1]" : "text-[#7d8698]"}`}
                    strokeWidth={1.4}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-[13px] font-bold text-brand">GB</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold">Amministratore</p>
            <p className="truncate text-[12px] text-muted">Rossi S.p.A.</p>
          </div>
          <button
            type="button"
            title="Esci"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}

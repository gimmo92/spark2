"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Generale", exact: true },
  { href: "/dashboard/mbo", label: "MBO", exact: false },
];

export function DashboardTabs() {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-bold">Dashboard</h1>
      <nav className="flex gap-1 border-b border-[#e3e7ee]" aria-label="Sezioni dashboard">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

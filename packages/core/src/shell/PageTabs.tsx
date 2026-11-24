"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Tab } from "../config";
import { useSparkConfig } from "./SparkProvider";
import { useNavAccess } from "../access/navAccess";
import { tr } from "../i18n/i18n";

/** Page title + tab bar. Used by the dashboard and settings pages (tabs come from the app config). */
export function PageTabs({ title, tabs, label }: { title: string; tabs: Tab[]; label: string }) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <h1 className="text-[18px] font-bold">{title}</h1>
      <nav className="flex gap-1 border-b border-[#e3e7ee]" aria-label={label}>
        {tabs.map((t) => {
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
              {tr(t.label)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function DashboardTabs() {
  const { visibleTabs } = useNavAccess();
  return <PageTabs title={tr("Dashboard")} tabs={visibleTabs(useSparkConfig().dashboardTabs)} label={tr("Sezioni dashboard")} />;
}

export function SettingsTabs() {
  const { visibleTabs } = useNavAccess();
  return <PageTabs title={tr("Impostazioni")} tabs={visibleTabs(useSparkConfig().settingsTabs)} label={tr("Sezioni impostazioni")} />;
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Lock } from "lucide-react";
import type { NavItem, SparkConfig, Tab } from "../config";
import { useData } from "../data/DataProvider";
import { useSparkConfig } from "../shell/SparkProvider";
import { useAccess } from "./useAccess";
import { tr } from "../i18n/i18n";

type Route = { href: string; permission?: string; exact?: boolean };

const matches = (r: Route, path: string) => (r.exact ? path === r.href : path === r.href || path.startsWith(r.href + "/"));

/** Every linked page of the app with the permission it needs (menu entries and tabs). */
function routesOf(config: SparkConfig): Route[] {
  const nav = config.nav.flatMap((i): Route[] => ("children" in i ? i.children : [i]));
  return [...nav, ...config.dashboardTabs, ...config.settingsTabs];
}

/** Menu, tabs and page access for the logged-in user. */
export function useNavAccess() {
  const config = useSparkConfig();
  const { allowed } = useAccess();

  return useMemo(() => {
    const ok = (r: Route) => !r.permission || allowed(r.permission);
    const tabs = [...config.dashboardTabs, ...config.settingsTabs];
    // a page that only hosts tabs (e.g. /impostazioni) is reachable if one of its tabs is
    const hostOk = (href: string) => {
      const inside = tabs.filter((t) => t.href === href || t.href.startsWith(href + "/"));
      return !inside.length || inside.some(ok);
    };
    const visibleTabs = (list: Tab[]) => list.filter(ok);
    const nav = config.nav
      .map((i): NavItem | null => {
        if ("children" in i) {
          const children = i.children.filter(ok);
          return children.length ? { ...i, children } : null;
        }
        return ok(i) && hostOk(i.href) ? i : null;
      })
      .filter((i): i is NavItem => !!i);

    const routes = routesOf(config);
    /** The most specific page matching `path`; undefined = not a menu page (always allowed). */
    const routeFor = (path: string) =>
      routes
        .filter((r) => matches(r, path))
        // most specific first; for the same href, an exact tab (e.g. Dashboard → Generale) wins over the menu entry
        .sort((a, b) => b.href.length - a.href.length || Number(!!b.exact) - Number(!!a.exact) || Number(!!b.permission) - Number(!!a.permission))[0];
    const canOpen = (path: string) => {
      const r = routeFor(path);
      return r ? ok(r) && hostOk(r.href) : true;
    };
    const firstAllowed = (prefer?: string) => {
      const pool = routes.filter((r) => ok(r) && hostOk(r.href) && !("muted" in r && r.muted));
      return (prefer && pool.find((r) => r.href.startsWith(prefer))?.href) || pool[0]?.href;
    };
    return { nav, visibleTabs, canOpen, firstAllowed };
  }, [config, allowed]);
}

/** Wraps every page: shows "no access" (or moves on to an allowed page) when the user lacks the permission. */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hydrated } = useData();
  const { home } = useSparkConfig();
  const { canOpen, firstAllowed } = useNavAccess();

  const blocked = hydrated && !canOpen(pathname);
  const section = "/" + (pathname.split("/")[1] ?? "");
  const next = blocked ? firstAllowed(section) : undefined;
  // landing pages (home, a section root) silently move to the first page the user can open
  const redirect = Boolean(blocked && next && next !== pathname && (pathname === home || pathname === section));

  useEffect(() => {
    if (redirect && next) router.replace(next);
  }, [redirect, next, router]);

  if (!blocked) return <>{children}</>;
  if (redirect) return null;
  return (
    <div className="card mx-auto mt-6 max-w-md p-8 text-center">
      <Lock className="mx-auto h-6 w-6 text-faint" />
      <p className="mt-3 text-[14px] font-semibold">{tr("Non hai accesso a questa pagina")}</p>
      <p className="mt-1 text-[12.5px] text-muted">{tr("Il tuo livello di accesso non la prevede. Se ti serve, chiedi a un amministratore.")}</p>
      {next && (
        <Link href={next} className="mt-4 inline-block text-[12.5px] font-semibold text-brand hover:underline">{tr("Vai a una pagina disponibile")}</Link>
      )}
    </div>
  );
}

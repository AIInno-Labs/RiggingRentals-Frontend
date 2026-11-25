"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountBubble } from "@/features/super-admin/components/common/badges";
import { COPY } from "@/features/super-admin/constants/copy";
import { NAV_ITEMS, QUERY, SA_ROUTES, SIGN_OUT_HREF, type NavItem } from "@/features/super-admin/constants/routes";
import { cn } from "@/lib/utils";

export type NavBadges = Partial<Record<NonNullable<NavItem["badgeKey"]>, number>>;

const isActive = (pathname: string, href: string) =>
  href === SA_ROUTES.dashboard ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

const darkOutline = "border border-zinc-700 bg-transparent text-zinc-50 hover:bg-zinc-800 hover:text-brand";

function HeaderFind() {
  const router = useRouter();
  return (
    <form
      role="search"
      className="min-w-0 flex-1 md:max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
        router.push(q ? `${SA_ROUTES.organizations}?${QUERY.search}=${encodeURIComponent(q)}` : SA_ROUTES.organizations);
      }}
    >
      <label htmlFor="sa_find" className="sr-only">
        {COPY.shell.findLabel}
      </label>
      <Input
        id="sa_find"
        name="q"
        type="search"
        autoComplete="off"
        placeholder={COPY.shell.findPlaceholder}
        className="h-9 border-zinc-700 bg-[#1a1a1a] text-zinc-50 placeholder:text-zinc-500"
      />
    </form>
  );
}

export function SuperAdminShell({ userName, badges, children }: { userName: string; badges: NavBadges; children: ReactNode }) {
  const pathname = usePathname();
  const badge = (item: NavItem) => (item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0);

  return (
    <div className="min-h-screen text-foreground md:flex">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-zinc-800 bg-brand-ink px-3 py-4 text-zinc-50 md:flex">
        <Link href={SA_ROUTES.dashboard} prefetch className="mb-6 shrink-0 rounded-sm px-1" title={COPY.shell.homeTitle}>
          <BrandLogo variant="nav" priority />
        </Link>
        <nav aria-label={COPY.shell.modulesNav} className="flex flex-col gap-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "bg-brand text-brand-ink" : "text-zinc-300 hover:bg-white/10 hover:text-white",
                )}
              >
                <span>{item.label}</span>
                <CountBubble count={badge(item)} inverted={active} />
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-zinc-800 pt-3">
          <p className="truncate px-2 text-sm font-medium">{userName}</p>
          <p className="mb-2 truncate px-2 text-xs text-zinc-400">{COPY.shell.roleLine}</p>
          <Button asChild size="sm" className={cn("w-full", darkOutline)}>
            <Link href={SIGN_OUT_HREF} prefetch={false}>
              {COPY.shell.signOut}
            </Link>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-zinc-800 bg-brand-ink text-zinc-50">
          <div className="h-1 w-full bg-brand" />
          <div className="flex items-center gap-3 px-3 py-2 md:px-6">
            <Link href={SA_ROUTES.dashboard} prefetch className="shrink-0 md:hidden" title={COPY.shell.homeTitle}>
              <BrandLogo variant="nav" priority />
            </Link>
            <h1 className="hidden min-w-0 truncate text-lg font-semibold sm:block md:text-xl">{COPY.shell.title}</h1>
            <HeaderFind />
            <Button asChild size="sm" className="hidden shrink-0 bg-brand text-brand-ink hover:bg-[#e6c600] md:inline-flex">
              <Link href={`${SA_ROUTES.organizations}?${QUERY.create}=1`}>{COPY.shell.addOrganization}</Link>
            </Button>
            <Button asChild size="sm" className={cn("md:hidden", darkOutline)}>
              <Link href={SIGN_OUT_HREF} prefetch={false}>
                {COPY.shell.signOutShort}
              </Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 overflow-x-clip px-4 py-5 pb-24 md:px-6 md:py-6 md:pb-8">{children}</main>

        <nav
          aria-label={COPY.shell.primaryNav}
          className="fixed inset-x-0 bottom-0 z-40 flex gap-0.5 overflow-x-auto border-t border-border bg-white p-1 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:hidden"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-14 flex-1 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-[11px] font-medium whitespace-nowrap",
                  active ? "bg-brand-ink text-brand" : "text-zinc-700 hover:bg-muted",
                )}
              >
                {item.shortLabel}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

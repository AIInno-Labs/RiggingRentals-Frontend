"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/features/auth/actions";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleNav } from "@/components/role-nav";
import type { AppRole } from "@/features/rbac/types";
import {
  findHrefForQuery,
  roleCanCreateQuote,
} from "@/features/rbac/portal-nav";
import { cn } from "@/lib/utils";

type PortalShellProps = {
  title: string;
  role: AppRole;
  fullName: string;
  children: ReactNode;
  /** Optional counts keyed by nav href (e.g. workshop Jobs / Repairs). */
  navBadges?: Record<string, number>;
};

function HeaderFind({ role }: { role: AppRole }) {
  const router = useRouter();
  const placeholder =
    role === "finance"
      ? "Quote or invoice #"
      : role === "workshop"
        ? "Order #, client, or RRP #"
        : "Client, quote #, or PO";

  return (
    <form
      className="min-w-0 flex-1 md:max-w-xs"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        router.push(findHrefForQuery(role, String(fd.get("q") ?? "")));
      }}
    >
      <label htmlFor="portal_find" className="sr-only">
        Find
      </label>
      <Input
        id="portal_find"
        name="q"
        placeholder={placeholder}
        className="h-9 border-[#3f3f46] bg-[#1a1a1a] text-[#fafafa] placeholder:text-[#71717a]"
        autoComplete="off"
      />
    </form>
  );
}

export function PortalShell({
  title,
  role,
  fullName,
  children,
  navBadges,
}: PortalShellProps) {
  const showQuote = roleCanCreateQuote(role);
  const pathname = usePathname();
  const salesDeskPath =
    pathname.startsWith("/admin/pipeline") ||
    pathname.startsWith("/admin/leads") ||
    pathname.startsWith("/admin/orders/new");
  const demoteHeaderQuote = salesDeskPath;

  return (
    <div className="min-h-screen text-foreground md:flex">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-[#27272a] bg-[#111111] px-3 py-4 text-[#fafafa] md:flex">
        <Link
          href="/"
          prefetch
          className="mb-6 shrink-0 rounded-sm px-1 outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f5d400]"
          title="Rigging Rentals home"
        >
          <BrandLogo variant="nav" priority />
        </Link>
        <Suspense fallback={<div className="min-h-[8rem]" aria-hidden />}>
          <RoleNav role={role} variant="side" badges={navBadges} />
        </Suspense>
        <div className="mt-auto border-t border-[#27272a] pt-3">
          <p className="truncate px-2 text-sm font-medium">{fullName || "Staff"}</p>
          <p className="mb-2 truncate px-2 text-xs capitalize text-[#a1a1aa]">
            {role.replace("_", " ")}
          </p>
          <form action={logoutAction}>
            <Button
              type="submit"
              size="sm"
              className="w-full border border-[#3f3f46] bg-transparent text-[#fafafa] hover:bg-[#27272a] hover:text-[#f5d400]"
            >
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[#27272a] bg-[#111111] text-[#fafafa]">
          <div className="h-1 w-full bg-[#f5d400]" />
          <div className="flex items-center gap-3 px-3 py-2 md:px-6">
            <Link
              href="/"
              prefetch
              className="shrink-0 md:hidden"
              title="Rigging Rentals home"
            >
              <BrandLogo variant="nav" priority />
            </Link>
            <h1 className="font-display hidden min-w-0 truncate text-lg font-semibold tracking-tight sm:block md:text-xl">
              {title}
            </h1>
            <HeaderFind role={role} />
            {showQuote ? (
              <Button
                asChild
                size="sm"
                className={cn(
                  "shrink-0",
                  demoteHeaderQuote
                    ? "border border-[#3f3f46] bg-transparent text-[#fafafa] hover:bg-[#27272a] hover:text-[#f5d400]"
                    : "bg-[#f5d400] text-[#111111] hover:bg-[#e6c600]",
                )}
              >
                <Link href="/admin/orders/new" prefetch>
                  New quote
                </Link>
              </Button>
            ) : null}
            <form action={logoutAction} className="md:hidden">
              <Button
                type="submit"
                size="sm"
                className="border border-[#3f3f46] bg-transparent text-[#fafafa] hover:bg-[#27272a]"
              >
                Out
              </Button>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-clip px-4 py-5 pb-24 md:px-6 md:py-6 md:pb-8">
          {children}
        </main>

        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white p-1 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:hidden"
        >
          <Suspense fallback={null}>
            <RoleNav role={role} variant="bottom" badges={navBadges} />
          </Suspense>
        </nav>
      </div>
    </div>
  );
}

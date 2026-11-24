"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/features/rbac/types";
import {
  activeMajorForPath,
  majorModulesForRole,
  navItemActive,
  type MajorModule,
  type NavLink,
} from "@/features/rbac/portal-nav";

function NavBadge({
  count,
  active,
  variant,
}: {
  count: number;
  active: boolean;
  variant: "side" | "bottom";
}) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 font-semibold tabular-nums",
        variant === "side" && "h-5 text-[10px]",
        variant === "bottom" && "mt-0.5 h-4 min-w-4 px-1 text-[9px]",
        active
          ? variant === "side"
            ? "bg-[#111111] text-[#f5d400]"
            : "bg-[#f5d400] text-[#111111]"
          : variant === "side"
            ? "bg-[#f5d400] text-[#111111]"
            : "bg-[#111111] text-[#f5d400]",
      )}
    >
      {label}
    </span>
  );
}

function NavItem({
  link,
  active,
  variant,
  badge,
  nested,
}: {
  link: NavLink;
  active: boolean;
  variant: "side" | "bottom";
  badge?: number;
  nested?: boolean;
}) {
  return (
    <Link
      href={link.href}
      prefetch
      title={link.title ?? link.label}
      className={cn(
        "whitespace-nowrap font-medium transition-colors",
        variant === "side" &&
          "flex items-center justify-between gap-2 rounded-lg py-2 text-sm",
        nested ? "px-3 pl-5" : "px-3",
        variant === "bottom" &&
          "flex flex-1 flex-col items-center justify-center rounded-lg px-1 py-1.5 text-[11px]",
        variant === "side" &&
          (active
            ? "bg-[#f5d400] text-[#111111]"
            : "text-[#d4d4d8] hover:bg-white/10 hover:text-white"),
        variant === "bottom" &&
          (active
            ? "bg-[#111111] text-[#f5d400]"
            : "text-[#3f3f46] hover:bg-muted"),
      )}
    >
      <span>{link.label}</span>
      <NavBadge count={badge ?? 0} active={active} variant={variant} />
    </Link>
  );
}

function MajorSection({
  major,
  expanded,
  isActiveMajor,
  onToggle,
  pathname,
  search,
  role,
  badges,
}: {
  major: MajorModule;
  expanded: boolean;
  isActiveMajor: boolean;
  onToggle: () => void;
  pathname: string;
  search: string;
  role: AppRole;
  badges?: Record<string, number>;
}) {
  const router = useRouter();

  return (
    <div className="grid gap-0.5">
      <button
        type="button"
        title={major.title ?? major.label}
        aria-expanded={expanded}
        onClick={() => {
          if (!expanded) {
            onToggle();
            router.push(major.home);
            return;
          }
          onToggle();
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide transition-colors",
          isActiveMajor
            ? "text-[#f5d400]"
            : "text-[#a1a1aa] hover:text-white",
        )}
      >
        <span>{major.label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 opacity-80 transition-transform duration-200",
            expanded ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
      </button>
      {expanded ? (
        <nav
          aria-label={`${major.label} screens`}
          className="flex flex-col gap-0.5"
        >
          {major.minors.map((link) => (
            <NavItem
              key={link.href}
              link={link}
              nested
              variant="side"
              active={navItemActive(pathname, link.href, role, search)}
              badge={badges?.[link.href]}
            />
          ))}
        </nav>
      ) : null}
    </div>
  );
}

export function RoleNav({
  role,
  variant = "side",
  badges,
}: {
  role: AppRole;
  variant?: "side" | "bottom";
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const majors = majorModulesForRole(role);
  const activeMajor = activeMajorForPath(majors, pathname);
  const multi = majors.length > 1;
  const showOpsHome = role === "super_admin" && multi;

  const [openIds, setOpenIds] = useState<Set<string>>(() =>
    new Set(activeMajor ? [activeMajor.id] : []),
  );

  useEffect(() => {
    if (!activeMajor) return;
    setOpenIds((prev) => {
      if (prev.has(activeMajor.id)) return prev;
      const next = new Set(prev);
      next.add(activeMajor.id);
      return next;
    });
  }, [activeMajor?.id]);

  if (variant === "bottom") {
    const bottomLinks: NavLink[] = showOpsHome
      ? [
          { href: "/admin", label: "Home", title: "Command center" },
          ...(activeMajor?.minors ?? majors[0]?.minors ?? []),
        ]
      : (activeMajor?.minors ?? majors[0]?.minors ?? []);

    if (bottomLinks.length === 0) return null;

    return (
      <nav
        aria-label="Screens"
        className="flex w-full items-stretch gap-0.5"
      >
        {bottomLinks.map((link) => (
          <NavItem
            key={link.href}
            link={link}
            variant="bottom"
            active={navItemActive(pathname, link.href, role, search)}
            badge={badges?.[link.href]}
          />
        ))}
      </nav>
    );
  }

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!multi) {
    const only = majors[0];
    if (!only) return null;
    return (
      <div className="flex flex-col gap-1">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-[#a1a1aa]">
          {only.label}
        </p>
        <nav
          aria-label={`${only.label} screens`}
          className="flex flex-col gap-0.5"
        >
          {only.minors.map((link) => (
            <NavItem
              key={link.href}
              link={link}
              nested
              variant="side"
              active={navItemActive(pathname, link.href, role, search)}
              badge={badges?.[link.href]}
            />
          ))}
        </nav>
      </div>
    );
  }

  return (
    <nav aria-label="Modules" className="flex flex-col gap-2">
      {showOpsHome ? (
        <NavItem
          link={{ href: "/admin", label: "Home", title: "Command center" }}
          variant="side"
          active={pathname === "/admin"}
          badge={badges?.["/admin"]}
        />
      ) : null}
      {majors.map((m) => (
        <MajorSection
          key={m.id}
          major={m}
          expanded={openIds.has(m.id)}
          isActiveMajor={activeMajor?.id === m.id}
          onToggle={() => toggle(m.id)}
          pathname={pathname}
          search={search}
          role={role}
          badges={badges}
        />
      ))}
    </nav>
  );
}

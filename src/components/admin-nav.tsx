"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/pipeline", label: "Orders" },
  { href: "/admin/orders/new", label: "New order" },
  { href: "/admin/availability", label: "Availability" },
  { href: "/admin/logistics", label: "Logistics" },
  { href: "/admin/maintenance", label: "Maintenance" },
  { href: "/admin/clients", label: "Clients" },
  { href: "/admin/catalog", label: "Catalog" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-[#d4d4d8] bg-[#ffffff]/90 p-1 shadow-sm backdrop-blur">
      {LINKS.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            prefetch
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-[#111111] text-[#f5d400]"
                : "text-[#5c6570] hover:bg-[#e4e4e7] hover:text-[#1a1f24]",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

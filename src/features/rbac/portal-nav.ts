import type { AppRole } from "@/features/rbac/types";

export type NavLink = { href: string; label: string; title?: string };

export type MajorModule = {
  id: string;
  label: string;
  title?: string;
  /** First destination when entering this major */
  home: string;
  minors: NavLink[];
  /** Path prefixes that belong to this major */
  match: string[];
};

export type NavGroup = {
  id: string;
  label: string;
  primary: NavLink[];
  more: NavLink[];
};

export function majorModulesForRole(role: AppRole): MajorModule[] {
  switch (role) {
    case "sales":
      return [
        {
          id: "sales",
          label: "Sales",
          title: "Quotes, enquiries, and clients",
          home: "/admin",
          match: [
            "/admin",
            "/admin/leads",
            "/admin/pipeline",
            "/admin/orders",
            "/admin/availability",
            "/admin/clients",
            "/admin/catalog",
          ],
          minors: [
            { href: "/admin", label: "Home", title: "Today’s work" },
            {
              href: "/admin/leads",
              label: "Enquiries",
              title: "Log phone/email enquiries",
            },
            { href: "/admin/pipeline", label: "Orders", title: "Quotes and hires" },
            {
              href: "/admin/pipeline?status=draft",
              label: "Quotes",
              title: "Outstanding quotes",
            },
            { href: "/admin/clients", label: "Customers", title: "Accounts" },
            {
              href: "/admin/availability",
              label: "Fleet",
              title: "Yard availability & rates",
            },
          ],
        },
      ];
    case "workshop":
      return [
        {
          id: "workshop",
          label: "Workshop",
          title: "Pack, dispatch, repairs",
          home: "/workshop",
          match: ["/workshop"],
          minors: [
            { href: "/workshop", label: "Jobs", title: "Dispatch & returns" },
            { href: "/workshop/repairs", label: "Repairs", title: "Repair bay" },
          ],
        },
      ];
    case "finance":
      return [
        {
          id: "finance",
          label: "Finance",
          title: "Invoices and AR",
          home: "/billing",
          match: ["/billing"],
          minors: [
            { href: "/billing", label: "Invoices", title: "Invoice queue" },
          ],
        },
      ];
    case "super_admin":
      return [
        {
          id: "sales",
          label: "Sales",
          title: "Enquiries, quotes, clients",
          home: "/admin/pipeline",
          match: [
            "/admin/leads",
            "/admin/pipeline",
            "/admin/orders",
            "/admin/clients",
          ],
          minors: [
            {
              href: "/admin/leads",
              label: "Enquiries",
              title: "Log phone/email enquiries",
            },
            { href: "/admin/pipeline", label: "Orders", title: "Quotes and hires" },
            {
              href: "/admin/pipeline?status=draft",
              label: "Quotes",
              title: "Outstanding quotes",
            },
            { href: "/admin/clients", label: "Customers", title: "Accounts" },
          ],
        },
        {
          id: "yard",
          label: "Yard",
          title: "Availability, logistics, catalog",
          home: "/admin/availability",
          match: ["/admin/availability", "/admin/logistics", "/admin/catalog"],
          minors: [
            {
              href: "/admin/availability",
              label: "Availability",
              title: "Hire-window grid",
            },
            {
              href: "/admin/logistics",
              label: "Logistics",
              title: "Deliveries & pickups",
            },
            { href: "/admin/catalog", label: "Catalog", title: "Fleet & rates" },
          ],
        },
        {
          id: "workshop",
          label: "Workshop",
          title: "Jobs, repairs, maintenance",
          home: "/workshop",
          match: ["/workshop", "/admin/maintenance"],
          minors: [
            { href: "/workshop", label: "Jobs", title: "Dispatch & returns" },
            { href: "/workshop/repairs", label: "Repairs", title: "Repair bay" },
            {
              href: "/admin/maintenance",
              label: "Maintenance",
              title: "Work orders",
            },
          ],
        },
        {
          id: "finance",
          label: "Finance",
          title: "Billing queue",
          home: "/billing",
          match: ["/billing"],
          minors: [
            { href: "/billing", label: "Invoices", title: "Invoice queue" },
          ],
        },
      ];
  }
}

/** Resolve which major owns the current path. Bare `/admin` is Ops Home (no major). */
export function activeMajorForPath(
  modules: MajorModule[],
  pathname: string,
): MajorModule | null {
  if (modules.length === 0) return null;
  if (modules.length === 1) return modules[0]!;

  // Ops command center is outside Sales / Yard / Workshop / Finance
  if (pathname === "/admin") return null;

  let best: MajorModule | null = null;
  let bestScore = -1;
  for (const m of modules) {
    for (const prefix of m.match) {
      const hit =
        pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (!hit) continue;
      const score = prefix.length;
      if (score > bestScore) {
        best = m;
        bestScore = score;
      }
    }
  }
  return best ?? modules[0]!;
}

/** Flat links (tests / legacy). */
export function navGroupForRole(role: AppRole): NavGroup {
  const majors = majorModulesForRole(role);
  const minors = majors.flatMap((m) => m.minors);
  const seen = new Set<string>();
  const primary: NavLink[] = [];
  for (const link of minors) {
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    primary.push(link);
  }
  return { id: role, label: portalTitleForRole(role), primary, more: [] };
}

export function navLinksForRole(role: AppRole): NavLink[] {
  return navGroupForRole(role).primary;
}

export function roleCanCreateQuote(role: AppRole): boolean {
  return role === "sales" || role === "super_admin";
}

export function findHrefForQuery(role: AppRole, raw: string): string {
  const q = raw.trim();
  const enc = encodeURIComponent(q);
  if (role === "finance") return q ? `/billing?q=${enc}` : "/billing";
  if (role === "workshop") return q ? `/workshop?q=${enc}` : "/workshop";
  return q ? `/admin/pipeline?q=${enc}` : "/admin/pipeline";
}

export function navItemActive(
  pathname: string,
  href: string,
  role: AppRole,
  search = "",
): boolean {
  const qs = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(qs);
  const status = params.get("status");

  const [hrefPath, hrefQuery = ""] = href.split("?");
  const hrefParams = new URLSearchParams(hrefQuery);
  const hrefStatus = hrefParams.get("status");

  if (hrefPath === "/admin/pipeline" && hrefStatus === "draft") {
    return pathname.startsWith("/admin/pipeline") && status === "draft";
  }

  if (href === "/admin" || href === "/workshop" || href === "/billing") {
    return pathname === href;
  }
  if (href === "/admin/availability") {
    return (
      pathname.startsWith("/admin/availability") ||
      (role === "sales" && pathname.startsWith("/admin/catalog"))
    );
  }
  if (href === "/admin/pipeline") {
    if (!pathname.startsWith("/admin/pipeline")) return false;
    return status !== "draft";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function portalTitleForRole(role: AppRole): string {
  switch (role) {
    case "sales":
      return "Sales desk";
    case "workshop":
      return "Workshop floor";
    case "finance":
      return "Finance desk";
    case "super_admin":
      return "Yard control";
  }
}

export const LIFECYCLE_STEPS = [
  { key: "quote", label: "1. Quote + PO", owner: "Sales", href: "/admin/pipeline" },
  {
    key: "confirm",
    label: "2. Confirm → workshop",
    owner: "Sales",
    href: "/admin/pipeline?status=confirmed",
  },
  { key: "dispatch", label: "3. Pack + Dispatch", owner: "Workshop", href: "/workshop" },
  {
    key: "offrent",
    label: "4. Off-hire",
    owner: "Sales",
    href: "/admin/pipeline?status=off_rent_pending",
  },
  { key: "return", label: "5. Return QC", owner: "Workshop", href: "/workshop?tab=returns" },
  { key: "invoice", label: "6. Invoice", owner: "Finance", href: "/billing" },
] as const;

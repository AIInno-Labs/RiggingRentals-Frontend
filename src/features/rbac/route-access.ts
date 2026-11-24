import type { AppRole } from "@/features/rbac/types";

export type Portal = "admin" | "workshop" | "billing";

const PORTAL_ROLES: Record<Portal, readonly AppRole[]> = {
  admin: ["super_admin", "sales"],
  workshop: ["super_admin", "workshop"],
  billing: ["super_admin", "finance"],
};

/** Path prefixes under /admin that sales must not reach. */
const ADMIN_RESTRICTED: { prefix: string; roles: readonly AppRole[] }[] = [
  {
    prefix: "/admin/logistics",
    roles: ["super_admin", "workshop"],
  },
  {
    prefix: "/admin/maintenance",
    roles: ["super_admin", "workshop"],
  },
];

export function portalFromPathname(pathname: string): Portal | null {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/workshop")) return "workshop";
  if (pathname.startsWith("/billing")) return "billing";
  return null;
}

export function canAccessPortal(role: AppRole, portal: Portal): boolean {
  return PORTAL_ROLES[portal].includes(role);
}

/** Fine-grained path check after portal access. */
export function canAccessPath(role: AppRole, pathname: string): boolean {
  // Finance opens return receipts from the invoice desk (workshop print route).
  if (
    (role === "finance" || role === "super_admin") &&
    /^\/workshop\/orders\/[^/]+\/return-receipt\/?$/.test(pathname)
  ) {
    return true;
  }

  const portal = portalFromPathname(pathname);
  if (portal && !canAccessPortal(role, portal)) return false;

  for (const rule of ADMIN_RESTRICTED) {
    if (
      pathname === rule.prefix ||
      pathname.startsWith(`${rule.prefix}/`)
    ) {
      return rule.roles.includes(role);
    }
  }
  return true;
}

export function canManageFleet(role: AppRole): boolean {
  return role === "super_admin";
}

export function canMutateLogistics(role: AppRole): boolean {
  return role === "super_admin" || role === "workshop";
}

export function homePathForRole(role: AppRole): string {
  switch (role) {
    case "super_admin":
    case "sales":
      return "/admin";
    case "workshop":
      return "/workshop";
    case "finance":
      return "/billing";
  }
}

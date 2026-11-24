import { QUERY } from "@/features/super-admin/constants/routes";
import type { PrivilegeType, ScopeMode, StatusFilter } from "@/features/super-admin/types";

/** Next.js page searchParams after awaiting. */
export type SearchParams = Record<string, string | string[] | undefined>;

export const firstParam = (sp: SearchParams, key: string): string => {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};

export function parseStatus(sp: SearchParams): StatusFilter {
  const v = firstParam(sp, QUERY.status);
  return v === "active" || v === "inactive" ? v : "all";
}

export function parsePrivilegeType(sp: SearchParams): PrivilegeType | "all" {
  const v = firstParam(sp, QUERY.type);
  return v === "MENU" || v === "ACTION" || v === "FIELD" ? v : "all";
}

export type ScopeSelection = {
  mode: ScopeMode;
  /** Set only when mode is "organization" and an organization is picked. */
  organizationId?: string;
};

/** Platform/Organization scope shared by the Parameters and Notifications pages. */
export function parseScope(sp: SearchParams, knownOrganizationIds: string[]): ScopeSelection {
  if (firstParam(sp, QUERY.scope) !== "organization") return { mode: "platform" };
  const org = firstParam(sp, QUERY.organization);
  return { mode: "organization", organizationId: knownOrganizationIds.includes(org) ? org : undefined };
}

/** Builds a link to a scoped page, e.g. Parameters for one organization. */
export function scopedHref(path: string, organizationId?: string): string {
  if (!organizationId) return path;
  const qs = new URLSearchParams({ [QUERY.scope]: "organization", [QUERY.organization]: organizationId });
  return `${path}?${qs.toString()}`;
}

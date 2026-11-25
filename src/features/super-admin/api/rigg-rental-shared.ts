import type {
  AustralianState,
  OrganizationSummary,
  Privilege,
  PrivilegeType,
  StatusFilter,
} from "@/features/super-admin/types";

/**
 * Pure request/response shapes and mappers for the Rigg Rental backend,
 * shared between the server-side adapter (http/rigg-rental-api.ts) and the
 * browser-direct client (client/rigg-rental-browser.ts). No "server-only" —
 * nothing here touches fetch, tokens, or env vars.
 */

export type BackendOrganization = {
  id: number;
  companyName: string;
  companyCode: string;
  address: string | null;
  city: string | null;
  country: string | null;
  postalCode: string | null;
  phone: string | null;
  mobileNumber: string | null;
  email: string | null;
  currency: string | null;
  createdAt: string | null;
};

export type BackendOrganizationAdmin = { name: string | null; email: string | null; phone: string | null };

export type BackendProvisionResponse = { organization: BackendOrganization; adminUsername: string };

export type BackendPrivilege = {
  id: number;
  privilege: string;
  privilegeCode: string;
  privilegeType: PrivilegeType;
  domain: string | null;
  active: boolean;
  createdAt: string | null;
};

/** Backend has no `state` column yet — this project operates out of WA, used as the fixed default. */
export const DEFAULT_STATE: AustralianState = "WA";

/** No pagination UI yet; large enough to mean "all" at this scale. */
export const LIST_PAGE_SIZE = 200;

export function toDate(value: string | null): string {
  return value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export function toSummary(org: BackendOrganization, admin: BackendOrganizationAdmin): OrganizationSummary {
  return {
    id: String(org.id),
    code: org.companyCode,
    name: org.companyName,
    state: DEFAULT_STATE,
    address: org.address ?? "",
    phone: org.phone ?? org.mobileNumber ?? "",
    email: org.email ?? "",
    active: true, // backend has no deactivate flag yet — every organization reads as active
    createdAt: toDate(org.createdAt),
    admin: { name: admin.name ?? "", email: admin.email ?? "", phone: admin.phone ?? "" },
    parameterOverrideCount: 0, // no Parameters domain on the backend yet
    customEmailCount: 0, // no Notifications domain on the backend yet
  };
}

export function matchesQuery(org: OrganizationSummary, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [org.name, org.code, org.state, org.address, org.admin.name, org.admin.email]
    .some((field) => field.toLowerCase().includes(needle));
}

export function matchesStatus(org: OrganizationSummary, status: StatusFilter | undefined): boolean {
  if (!status || status === "all") return true;
  return status === "active" ? org.active : !org.active;
}

export function toPrivilege(p: BackendPrivilege): Privilege {
  return {
    code: p.privilegeCode,
    label: p.privilege,
    type: p.privilegeType,
    area: p.domain ?? "",
    description: "", // no backend field
    active: p.active,
    createdAt: toDate(p.createdAt),
  };
}

import { ApiError, type ApiErrorCode, type SuperAdminApi } from "@/features/super-admin/api/contract";
import { mockSuperAdminApi } from "@/features/super-admin/api/mock/mock-api";
import type {
  AustralianState,
  CreateOrganizationInput,
  CreatePrivilegeInput,
  OrganizationDetail,
  OrganizationFilters,
  OrganizationInput,
  OrganizationOption,
  OrganizationSummary,
  Privilege,
  PrivilegeFilters,
  PrivilegeList,
  PrivilegeType,
  StatusFilter,
  UpdatePrivilegeInput,
} from "@/features/super-admin/types";

/**
 * Real implementation for Organizations and Privileges, backed by the Rigg
 * Rental Spring Boot API (see /Users/avinash/Desktop/Avinash/BMS/Rigg-Rental-Backend).
 * Everything else (dashboard, parameters, notifications, profile/MFA) has no
 * backend counterpart yet, so those methods delegate to the mock API — see
 * the `...mockSuperAdminApi` spread at the bottom.
 *
 * Switch on with:
 *   SUPER_ADMIN_API_MODE=rigg-rental
 *   RIGG_RENTAL_API_URL=http://localhost:8090/api/v1   (no trailing slash)
 *   RIGG_RENTAL_SUPERADMIN_EMAIL=superadmin@rigg-rental.local
 *   RIGG_RENTAL_SUPERADMIN_PASSWORD=superadmin123
 *
 * Known gaps, intentionally left as errors rather than faked:
 *   - Organization has no `state` field on the backend. It's accepted on
 *     create/update and echoed back, but never persisted.
 *   - Organizations can't be deactivated or have their admin's password
 *     reset — the backend has no such operations yet.
 *   - Privilege `description` has no backend field; it's silently dropped.
 *   - Creating a FIELD-type privilege will fail: the backend requires
 *     `fieldKey`/`accessMode`, which this contract has no slot for.
 */

type Query = Record<string, string | undefined>;

function apiUrl(): string {
  const url = process.env.RIGG_RENTAL_API_URL?.replace(/\/$/, "");
  if (!url) throw new ApiError("UNAVAILABLE", "RIGG_RENTAL_API_URL is not set.", 503);
  return url;
}

// ---------------------------------------------------------------- auth
// No real per-admin sign-in exists yet for this panel (same as the mock API
// today — see docs/super-admin-api-contract.md: "Authentication isn't wired
// yet"). This logs in once, server-side, as the seeded platform Super Admin
// and reuses the token until it's close to expiring.

let cachedToken: { value: string; expiresAt: number } | null = null;

async function fetchServiceToken(): Promise<string> {
  const email = process.env.RIGG_RENTAL_SUPERADMIN_EMAIL ?? "superadmin@rigg-rental.local";
  const password = process.env.RIGG_RENTAL_SUPERADMIN_PASSWORD ?? "superadmin123";

  let res: Response;
  try {
    res = await fetch(`${apiUrl()}/auth/authenticate`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ApiError("UNAVAILABLE", "The Rigg Rental API can't be reached.", 503);
  }
  if (!res.ok) {
    throw new ApiError("UNAVAILABLE", "Could not sign in to the Rigg Rental API as Super Admin.", 503);
  }
  const body = (await res.json()) as { token: string; expiresIn: number };
  cachedToken = { value: body.token, expiresAt: Date.now() + body.expiresIn - 60_000 };
  return body.token;
}

async function authHeader(forceRefresh = false): Promise<Record<string, string>> {
  if (forceRefresh || !cachedToken || Date.now() >= cachedToken.expiresAt) {
    await fetchServiceToken();
  }
  return { Authorization: `Bearer ${cachedToken!.value}` };
}

// -------------------------------------------------------------- request

const STATUS_CODES: Record<number, ApiErrorCode> = {
  400: "VALIDATION",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "VALIDATION",
};

async function request<T>(method: string, path: string, options: { query?: Query; body?: unknown } = {}): Promise<T> {
  const url = new URL(`${apiUrl()}${path}`);
  Object.entries(options.query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  });

  const doFetch = async (headers: Record<string, string>) =>
    fetch(url, {
      method,
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

  let res: Response;
  try {
    res = await doFetch(await authHeader());
    // The service token can expire between requests in a long-lived server
    // process; one retry with a forced refresh covers that without a caller
    // ever seeing a stale-token 403.
    if (res.status === 403) {
      res = await doFetch(await authHeader(true));
    }
  } catch {
    throw new ApiError("UNAVAILABLE", "The Rigg Rental API can't be reached.", 503);
  }

  if (!res.ok) {
    // Backend error body shape is { "error": "…" }, not { "message": "…" }.
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(STATUS_CODES[res.status] ?? "UNKNOWN", payload?.error ?? "The request failed.", res.status);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

// --------------------------------------------------------- organizations

type BackendOrganization = {
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

type BackendOrganizationAdmin = { name: string | null; email: string | null; phone: string | null };

type BackendProvisionResponse = { organization: BackendOrganization; adminUsername: string };

/** Backend has no `state` column yet — this project operates out of WA, used as the fixed default. */
const DEFAULT_STATE: AustralianState = "WA";

const LIST_PAGE_SIZE = 200; // no pagination UI yet; large enough to mean "all" at this scale

function toDate(value: string | null): string {
  return value ? value.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

async function fetchAdmin(id: number): Promise<BackendOrganizationAdmin> {
  try {
    return await request<BackendOrganizationAdmin>("GET", `/organizations/${id}/admin`);
  } catch {
    // Organization exists but has no admin user yet (shouldn't happen via
    // this panel's own create flow, but don't let the whole page 500 over it).
    return { name: null, email: null, phone: null };
  }
}

function toSummary(org: BackendOrganization, admin: BackendOrganizationAdmin): OrganizationSummary {
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

function matchesQuery(org: OrganizationSummary, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [org.name, org.code, org.state, org.address, org.admin.name, org.admin.email]
    .some((field) => field.toLowerCase().includes(needle));
}

function matchesStatus(org: OrganizationSummary, status: StatusFilter | undefined): boolean {
  if (!status || status === "all") return true;
  return status === "active" ? org.active : !org.active;
}

async function listOrganizationSummaries(): Promise<OrganizationSummary[]> {
  const page = await request<{ content: BackendOrganization[] }>("GET", "/organizations", {
    query: { size: String(LIST_PAGE_SIZE) },
  });
  return Promise.all(page.content.map(async (org) => toSummary(org, await fetchAdmin(org.id))));
}

const organizationsApi: Pick<
  SuperAdminApi,
  | "listOrganizations"
  | "listOrganizationOptions"
  | "getOrganization"
  | "createOrganization"
  | "updateOrganization"
  | "setOrganizationActive"
  | "resetOrganizationAdminPassword"
> = {
  async listOrganizations(filters: OrganizationFilters = {}) {
    const all = await listOrganizationSummaries();
    return all.filter((org) => matchesStatus(org, filters.status) && matchesQuery(org, filters.q ?? ""));
  },

  async listOrganizationOptions(): Promise<OrganizationOption[]> {
    const page = await request<{ content: BackendOrganization[] }>("GET", "/organizations", {
      query: { size: String(LIST_PAGE_SIZE) },
    });
    return page.content.map((org) => ({ id: String(org.id), code: org.companyCode, name: org.companyName, active: true }));
  },

  async getOrganization(id: string): Promise<OrganizationDetail> {
    const org = await request<BackendOrganization>("GET", `/organizations/${encodeURIComponent(id)}`);
    const admin = await fetchAdmin(org.id);
    return { ...toSummary(org, admin), missingParameterCount: 0, emailsOnCount: 0 };
  },

  async createOrganization(input: CreateOrganizationInput): Promise<OrganizationSummary> {
    const response = await request<BackendProvisionResponse>("POST", "/organizations", {
      body: {
        companyName: input.name,
        companyCode: input.code,
        address: input.address,
        phone: input.phone,
        email: input.email,
        adminEmail: input.admin.email,
        adminPassword: input.admin.temporaryPassword,
        adminDisplayName: input.admin.name,
        adminMobileNumber: input.admin.phone,
      },
    });
    return toSummary(response.organization, {
      name: input.admin.name,
      email: input.admin.email,
      phone: input.admin.phone,
    });
  },

  async updateOrganization(id: string, input: OrganizationInput): Promise<OrganizationSummary> {
    await request("PUT", "/organizations", {
      body: {
        id: Number(id),
        companyName: input.name,
        companyCode: input.code,
        address: input.address,
        phone: input.phone,
        email: input.email,
      },
    });
    const org = await request<BackendOrganization>("GET", `/organizations/${encodeURIComponent(id)}`);
    return toSummary(org, await fetchAdmin(org.id));
  },

  async setOrganizationActive(): Promise<OrganizationSummary> {
    throw new ApiError("UNAVAILABLE", "Activating or deactivating organizations isn't supported by the backend yet.", 501);
  },

  async resetOrganizationAdminPassword(): Promise<{ email: string }> {
    throw new ApiError(
      "UNAVAILABLE",
      "Resetting an organization admin's password isn't supported by the backend yet.",
      501,
    );
  },
};

// ------------------------------------------------------------ privileges

type BackendPrivilege = {
  id: number;
  privilege: string;
  privilegeCode: string;
  privilegeType: PrivilegeType;
  domain: string | null;
  active: boolean;
  createdAt: string | null;
};

function toPrivilege(p: BackendPrivilege): Privilege {
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

async function fetchAllPrivileges(): Promise<BackendPrivilege[]> {
  return request<BackendPrivilege[]>("GET", "/privileges");
}

async function findPrivilegeByCode(code: string): Promise<BackendPrivilege> {
  const all = await fetchAllPrivileges();
  const found = all.find((p) => p.privilegeCode === code);
  if (!found) throw new ApiError("NOT_FOUND", `No privilege with code ${code}.`, 404);
  return found;
}

const privilegesApi: Pick<SuperAdminApi, "listPrivileges" | "createPrivilege" | "updatePrivilege" | "setPrivilegeActive"> = {
  async listPrivileges(filters: PrivilegeFilters = {}): Promise<PrivilegeList> {
    const all = (await fetchAllPrivileges()).map(toPrivilege);

    const countsByType = { MENU: 0, ACTION: 0, FIELD: 0 } as Record<PrivilegeType, number>;
    const areas = new Set<string>();
    for (const p of all) {
      countsByType[p.type] += 1;
      if (p.area) areas.add(p.area);
    }

    const q = (filters.q ?? "").trim().toLowerCase();
    const items = all.filter((p) => {
      if (filters.type && filters.type !== "all" && p.type !== filters.type) return false;
      if (filters.status && filters.status !== "all" && p.active !== (filters.status === "active")) return false;
      if (q && !`${p.code} ${p.label} ${p.area}`.toLowerCase().includes(q)) return false;
      return true;
    });

    return { items, total: all.length, countsByType, areas: Array.from(areas).sort() };
  },

  async createPrivilege(input: CreatePrivilegeInput): Promise<void> {
    await request("POST", "/privileges", {
      body: { privilege: input.label, privilegeCode: input.code, privilegeType: input.type, domain: input.area },
    });
  },

  async updatePrivilege(code: string, input: UpdatePrivilegeInput): Promise<void> {
    const existing = await findPrivilegeByCode(code);
    await request("PUT", `/privileges/${existing.id}`, {
      body: { privilege: input.label, privilegeType: input.type, domain: input.area },
    });
  },

  async setPrivilegeActive(code: string, active: boolean): Promise<void> {
    const existing = await findPrivilegeByCode(code);
    await request("PUT", `/privileges/${existing.id}`, { body: { privilege: existing.privilege, active } });
  },
};

// --------------------------------------------------------------- export

export const riggRentalSuperAdminApi: SuperAdminApi = {
  ...mockSuperAdminApi, // dashboard, parameters, notifications, profile/MFA — not built on the backend yet
  ...organizationsApi,
  ...privilegesApi,
};

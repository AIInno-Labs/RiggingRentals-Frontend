import { ApiError } from "@/features/super-admin/api/contract";
import {
  type BackendOrganization,
  type BackendOrganizationAdmin,
  type BackendPrivilege,
  LIST_PAGE_SIZE,
  matchesQuery,
  matchesStatus,
  toPrivilege,
  toSummary,
} from "@/features/super-admin/api/rigg-rental-shared";
import type {
  OrganizationFilters,
  OrganizationSummary,
  PrivilegeFilters,
  PrivilegeList,
} from "@/features/super-admin/types";

/**
 * Browser-direct calls to the Rigg Rental backend — these run in the
 * browser, not the Next.js server, so they show up in DevTools' Network tab
 * against the real backend URL. Read-only (Organizations/Privileges lists),
 * used by the table components in parallel with their normal server-fetched
 * data purely so the call is visible; mutations still go through the
 * existing Server Actions (src/features/super-admin/actions/).
 *
 * The bearer token comes from GET /api/super-admin/token (a Next.js Route
 * Handler) rather than embedding the Super Admin password here — see that
 * route's SECURITY NOTE for what this does and doesn't protect.
 */

type Query = Record<string, string | undefined>;

function apiUrl(): string {
  const url = process.env.NEXT_PUBLIC_RIGG_RENTAL_API_URL?.replace(/\/$/, "");
  if (!url) throw new ApiError("UNAVAILABLE", "NEXT_PUBLIC_RIGG_RENTAL_API_URL is not set.", 503);
  return url;
}

let cachedToken: string | null = null;

async function fetchToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken) return cachedToken;
  const res = await fetch("/api/super-admin/token", { cache: "no-store" });
  if (!res.ok) throw new ApiError("UNAVAILABLE", "Could not obtain a Rigg Rental API token.", 503);
  const body = (await res.json()) as { token: string };
  cachedToken = body.token;
  return cachedToken;
}

async function request<T>(method: string, path: string, query: Query = {}): Promise<T> {
  const url = new URL(`${apiUrl()}${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  });

  const doFetch = async (token: string) =>
    fetch(url, {
      method,
      cache: "no-store",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });

  let res = await doFetch(await fetchToken());
  if (res.status === 401 || res.status === 403) {
    res = await doFetch(await fetchToken(true));
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError("UNKNOWN", payload?.error ?? "The request failed.", res.status);
  }
  return (await res.json()) as T;
}

async function fetchAdmin(id: number): Promise<BackendOrganizationAdmin> {
  try {
    return await request<BackendOrganizationAdmin>("GET", `/organizations/${id}/admin`);
  } catch {
    return { name: null, email: null, phone: null };
  }
}

export async function listOrganizationsDirect(filters: OrganizationFilters = {}): Promise<OrganizationSummary[]> {
  const page = await request<{ content: BackendOrganization[] }>("GET", "/organizations", {
    size: String(LIST_PAGE_SIZE),
  });
  const all = await Promise.all(page.content.map(async (org) => toSummary(org, await fetchAdmin(org.id))));
  return all.filter((org) => matchesStatus(org, filters.status) && matchesQuery(org, filters.q ?? ""));
}

export async function listPrivilegesDirect(filters: PrivilegeFilters = {}): Promise<PrivilegeList> {
  const all = (await request<BackendPrivilege[]>("GET", "/privileges")).map(toPrivilege);

  const countsByType = { MENU: 0, ACTION: 0, FIELD: 0 } as Record<(typeof all)[number]["type"], number>;
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
}

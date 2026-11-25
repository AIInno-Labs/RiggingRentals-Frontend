import "server-only";
import { cache } from "react";
import { request } from "@/features/super-admin/api/http/client";
import {
  type BackendOrganization,
  type BackendOrganizationAdmin,
  type BackendParameter,
  type BackendUser,
  LIST_PAGE_SIZE,
} from "@/features/super-admin/api/rigg-rental-shared";
import { PARAMETER_GROUPS } from "@/features/super-admin/constants/parameter-catalog";
import { decodeValue, isEmptyValue } from "@/features/super-admin/lib/parameter-values";
import type { ParameterDefinition, ParameterValue } from "@/features/super-admin/types";

/**
 * Backend reads shared by several areas (the dashboard, organizations and
 * parameters all need the organization list and parameter values).
 * `cache()` makes each one run at most once per request, so a page and its
 * layout asking for the same data cost one backend call.
 */

/** GET /auth/me */
export const loadCurrentUser = cache(() => request<BackendUser>("GET", "/auth/me"));

/** GET /organizations */
export const loadOrganizations = cache(async (): Promise<BackendOrganization[]> => {
  const page = await request<{ content: BackendOrganization[] }>("GET", "/organizations", {
    query: { size: LIST_PAGE_SIZE },
  });
  return page.content;
});

/** GET /organizations/{id}/admin — blank when the organization has no admin user. */
export const loadOrganizationAdmin = cache(async (id: number): Promise<BackendOrganizationAdmin> => {
  try {
    return await request<BackendOrganizationAdmin>("GET", `/organizations/${id}/admin`);
  } catch {
    return { name: null, email: null, phone: null };
  }
});

/* ---------- parameters ---------- */

export type ParameterRows = Map<string, BackendParameter>;
const byName = (rows: BackendParameter[]): ParameterRows => new Map(rows.map((r) => [r.paramName, r]));

/** GET /admin/parameters — platform defaults. */
export const loadPlatformParameters = cache(async (): Promise<ParameterRows> =>
  byName(await request<BackendParameter[]>("GET", "/admin/parameters")),
);

/** GET /admin/parameters?organizationId= — only the organization's own rows (not inherited ones). */
export const loadOwnParameters = cache(async (organizationId: string): Promise<ParameterRows> => {
  const rows = await request<BackendParameter[]>("GET", "/admin/parameters", { query: { organizationId } });
  return byName(rows.filter((r) => r.inherited === false && r.organizationId !== null));
});

/** The value in effect: the organization's own, else the platform's. */
export function effectiveValue(def: ParameterDefinition, platform: ParameterRows, own?: ParameterRows): ParameterValue | null {
  const row = own?.get(def.key) ?? platform.get(def.key);
  return decodeValue(def, row?.paramValue);
}

/** Required values that are empty while their service is switched on. */
export function missingKeys(platform: ParameterRows, own?: ParameterRows): string[] {
  return PARAMETER_GROUPS.flatMap((g) =>
    effectiveValue(g.items[0], platform, own)
      ? g.items.filter((i) => i.required && isEmptyValue(effectiveValue(i, platform, own))).map((i) => i.key)
      : [],
  );
}

/** Every organization's own rows, keyed by organization id. */
export const loadAllOwnParameters = cache(async (): Promise<Map<string, ParameterRows>> => {
  const organizations = await loadOrganizations();
  const entries = await Promise.all(
    organizations.map(async (o) => [String(o.id), await loadOwnParameters(String(o.id))] as const),
  );
  return new Map(entries);
});

/** Platform gaps, plus organization gaps that aren't just inherited platform gaps. */
export const loadMissingParameterCount = cache(async (): Promise<number> => {
  const [platform, allOwn] = await Promise.all([loadPlatformParameters(), loadAllOwnParameters()]);
  const platformGaps = new Set(missingKeys(platform));
  let orgGaps = 0;
  for (const own of allOwn.values()) {
    orgGaps += missingKeys(platform, own).filter((k) => !platformGaps.has(k)).length;
  }
  return platformGaps.size + orgGaps;
});

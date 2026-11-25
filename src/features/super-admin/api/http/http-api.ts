import { ApiError, type ApiErrorCode, type SuperAdminApi } from "@/features/super-admin/api/contract";
import type { ParameterScope } from "@/features/super-admin/types";

/**
 * Spring Boot implementation of the Super Admin API.
 * Not used yet: switch on with SUPER_ADMIN_API_MODE=http and SUPER_ADMIN_API_URL.
 * Endpoints follow docs/super-admin-api-contract.md.
 */

type Query = Record<string, string | undefined>;

function baseUrl(): string {
  const url = process.env.SUPER_ADMIN_API_URL?.replace(/\/$/, "");
  if (!url) throw new ApiError("UNAVAILABLE", "SUPER_ADMIN_API_URL is not set.", 503);
  return url;
}

/** Attach the signed-in user's token here once the backend issues one. */
async function authHeaders(): Promise<Record<string, string>> {
  return {};
}

const STATUS_CODES: Record<number, ApiErrorCode> = { 400: "VALIDATION", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 422: "VALIDATION" };

async function request<T>(method: string, path: string, options: { query?: Query; body?: unknown } = {}): Promise<T> {
  const url = new URL(`${baseUrl()}${path}`);
  Object.entries(options.query ?? {}).forEach(([k, v]) => {
    if (v !== undefined && v !== "") url.searchParams.set(k, v);
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(await authHeaders()) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError("UNAVAILABLE", "The Super Admin service can't be reached.", 503);
  }

  if (!res.ok) {
    // Expected error body: { "message": "…" }
    const payload = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(STATUS_CODES[res.status] ?? "UNKNOWN", payload?.message ?? "The request failed.", res.status);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const orgQuery = (scope?: ParameterScope): Query => ({ organizationId: scope?.organizationId });

export const httpSuperAdminApi: SuperAdminApi = {
  getDashboardSummary: () => request("GET", "/platform/dashboard"),
  getNavBadges: () => request("GET", "/platform/nav-badges"),

  listOrganizations: (f = {}) => request("GET", "/platform/organizations", { query: { q: f.q, status: f.status } }),
  listOrganizationOptions: () => request("GET", "/platform/organizations/options"),
  getOrganization: (id) => request("GET", `/platform/organizations/${encodeURIComponent(id)}`),
  createOrganization: (input) => request("POST", "/platform/organizations", { body: input }),
  updateOrganization: (id, input) => request("PUT", `/platform/organizations/${encodeURIComponent(id)}`, { body: input }),
  setOrganizationActive: (id, active) =>
    request("PATCH", `/platform/organizations/${encodeURIComponent(id)}/status`, { body: { active } }),
  resetOrganizationAdminPassword: (id) =>
    request("POST", `/platform/organizations/${encodeURIComponent(id)}/admin/password-reset`),

  listPrivileges: (f = {}) => request("GET", "/platform/privileges", { query: { q: f.q, type: f.type, status: f.status } }),
  createPrivilege: (input) => request("POST", "/platform/privileges", { body: input }),
  updatePrivilege: (code, input) => request("PUT", `/platform/privileges/${encodeURIComponent(code)}`, { body: input }),
  setPrivilegeActive: (code, active) =>
    request("PATCH", `/platform/privileges/${encodeURIComponent(code)}/status`, { body: { active } }),

  getParameters: (scope) => request("GET", "/platform/parameters", { query: orgQuery(scope) }),
  updateParameter: (key, value, scope) =>
    request("PUT", `/platform/parameters/${encodeURIComponent(key)}`, { query: orgQuery(scope), body: { value } }),
  resetParameter: (key, organizationId) =>
    request("DELETE", `/platform/parameters/${encodeURIComponent(key)}`, { query: { organizationId } }),
  testParameterGroup: (group, scope) =>
    request("POST", `/platform/parameters/${encodeURIComponent(group)}/test`, { query: orgQuery(scope) }),

  listEmailTemplates: (scope) => request("GET", "/platform/notifications", { query: orgQuery(scope) }),
  updateEmailTemplate: (id, input, scope) =>
    request("PUT", `/platform/notifications/${encodeURIComponent(id)}`, { query: orgQuery(scope), body: input }),
  setEmailEnabled: (id, enabled, scope) =>
    request("PATCH", `/platform/notifications/${encodeURIComponent(id)}/enabled`, { query: orgQuery(scope), body: { enabled } }),
  resetEmailTemplate: (id, organizationId) =>
    request("DELETE", `/platform/notifications/${encodeURIComponent(id)}`, { query: { organizationId } }),
  sendTestEmail: (id, scope) =>
    request("POST", `/platform/notifications/${encodeURIComponent(id)}/test`, { query: orgQuery(scope) }),
  getEmailPreviewContext: (scope) => request("GET", "/platform/notifications/preview-context", { query: orgQuery(scope) }),

  getProfile: () => request("GET", "/me"),
  updateProfile: (input) => request("PUT", "/me", { body: input }),
  changePassword: (input) => request("POST", "/me/password", { body: input }),
  startMfaSetup: () => request("POST", "/me/mfa/setup"),
  confirmMfa: (code) => request("POST", "/me/mfa/confirm", { body: { code } }),
  disableMfa: () => request("DELETE", "/me/mfa"),
};

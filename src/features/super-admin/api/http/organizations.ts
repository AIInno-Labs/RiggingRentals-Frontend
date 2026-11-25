import "server-only";
import type { SuperAdminApi } from "@/features/super-admin/api/contract";
import { request } from "@/features/super-admin/api/http/client";
import {
  loadAllOwnParameters,
  loadOrganizationAdmin,
  loadOrganizations,
  loadOwnParameters,
  loadPlatformParameters,
  missingKeys,
} from "@/features/super-admin/api/http/loaders";
import { notAvailable } from "@/features/super-admin/api/http/not-available";
import { mockOrganizationEmailCounts } from "@/features/super-admin/api/mock/notifications";
import {
  type BackendOrganization,
  type BackendProvisionResponse,
  matchesQuery,
  matchesStatus,
  toSummary,
} from "@/features/super-admin/api/rigg-rental-shared";
import type { OrganizationSummary } from "@/features/super-admin/types";

/**
 * Organizations — backend: /organizations.
 *
 * Known backend gaps:
 *  - no `state` column: shown as WA and accepted on save, but not stored;
 *  - no active/inactive flag: every organization reads as active;
 *  - no Notifications domain: email counts come from the mock.
 */

async function summarize(org: BackendOrganization, ownParameterCount: number): Promise<OrganizationSummary> {
  return {
    ...toSummary(org, await loadOrganizationAdmin(org.id)),
    parameterOverrideCount: ownParameterCount,
    // TODO(backend): Notifications domain — mock count until then.
    customEmailCount: mockOrganizationEmailCounts(String(org.id)).customEmailCount,
  };
}

export const organizationsApi = {
  async listOrganizations(filters = {}) {
    const [organizations, allOwn] = await Promise.all([loadOrganizations(), loadAllOwnParameters()]);
    const all = await Promise.all(organizations.map((o) => summarize(o, allOwn.get(String(o.id))?.size ?? 0)));
    return all.filter((org) => matchesStatus(org, filters.status) && matchesQuery(org, filters.q ?? ""));
  },

  async listOrganizationOptions() {
    const organizations = await loadOrganizations();
    return organizations.map((o) => ({ id: String(o.id), code: o.companyCode, name: o.companyName, active: true }));
  },

  async getOrganization(id) {
    const [org, platform, own] = await Promise.all([
      request<BackendOrganization>("GET", `/organizations/${encodeURIComponent(id)}`),
      loadPlatformParameters(),
      loadOwnParameters(id),
    ]);
    return {
      ...(await summarize(org, own.size)),
      missingParameterCount: missingKeys(platform, own).length,
      // TODO(backend): Notifications domain — mock count until then.
      emailsOnCount: mockOrganizationEmailCounts(id).emailsOnCount,
    };
  },

  async createOrganization(input) {
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
    return toSummary(response.organization, { name: input.admin.name, email: input.admin.email, phone: input.admin.phone });
  },

  async updateOrganization(id, input) {
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
    return summarize(org, (await loadOwnParameters(id)).size);
  },

  async setOrganizationActive() {
    // TODO(backend): PATCH /organizations/{id}/status  { active }  → returns the organization
    //   const org = await request<BackendOrganization>("PATCH", `/organizations/${id}/status`, { body: { active } });
    //   return summarize(org, (await loadOwnParameters(id)).size);
    // Also map the new flag in toSummary() (rigg-rental-shared.ts).
    return notAvailable("Activating or deactivating organizations");
  },

  async resetOrganizationAdminPassword() {
    // TODO(backend): POST /organizations/{id}/admin/password-reset  → { email }
    //   return request<{ email: string }>("POST", `/organizations/${id}/admin/password-reset`);
    return notAvailable("Resetting an organization Admin's password");
  },
} satisfies Pick<
  SuperAdminApi,
  | "listOrganizations"
  | "listOrganizationOptions"
  | "getOrganization"
  | "createOrganization"
  | "updateOrganization"
  | "setOrganizationActive"
  | "resetOrganizationAdminPassword"
>;

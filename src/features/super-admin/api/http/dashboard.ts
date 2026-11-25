import "server-only";
import type { SuperAdminApi } from "@/features/super-admin/api/contract";
import {
  effectiveValue,
  loadAllOwnParameters,
  loadMissingParameterCount,
  loadOrganizations,
  loadPlatformParameters,
} from "@/features/super-admin/api/http/loaders";
import { loadPrivileges } from "@/features/super-admin/api/http/privileges";
import { mockEmailSummary } from "@/features/super-admin/api/mock/notifications";
import { PARAMETER_GROUPS } from "@/features/super-admin/constants/parameter-catalog";

/**
 * Dashboard figures, worked out from the real Organizations, Privileges and
 * Parameters data (the backend has no dashboard endpoint of its own). The
 * Emails tile uses the mock Notifications data until the backend has it.
 */
export const dashboardApi = {
  async getDashboardSummary() {
    const [organizations, privileges, platform, allOwn, missingParameters] = await Promise.all([
      loadOrganizations(),
      loadPrivileges(),
      loadPlatformParameters(),
      loadAllOwnParameters(),
      loadMissingParameterCount(),
    ]);
    const activePrivileges = privileges.filter((p) => p.active).length;
    const ownCounts = [...allOwn.values()].map((rows) => rows.size);

    return {
      organizations: {
        active: organizations.length, // backend has no active/inactive flag yet
        inactive: 0,
        total: organizations.length,
      },
      privileges: { active: activePrivileges, inactive: privileges.length - activePrivileges },
      services: {
        enabled: PARAMETER_GROUPS.filter((g) => effectiveValue(g.items[0], platform)).map((g) => g.name),
        total: PARAMETER_GROUPS.length,
      },
      parameterOverrides: {
        total: ownCounts.reduce((a, b) => a + b, 0),
        organizations: ownCounts.filter((n) => n > 0).length,
      },
      missingParameters,
      // TODO(backend): Notifications domain — mock figures until then.
      emails: mockEmailSummary(organizations.map((o) => String(o.id))),
    };
  },

  async getNavBadges() {
    return { parameters: await loadMissingParameterCount() };
  },
} satisfies Pick<SuperAdminApi, "getDashboardSummary" | "getNavBadges">;

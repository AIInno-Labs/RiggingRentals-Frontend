import "server-only";
import type { SuperAdminApi } from "@/features/super-admin/api/contract";
import { request } from "@/features/super-admin/api/http/client";
import { effectiveValue, loadOwnParameters, loadPlatformParameters } from "@/features/super-admin/api/http/loaders";
import type { BackendOrganization } from "@/features/super-admin/api/rigg-rental-shared";
import { parameterDefinition } from "@/features/super-admin/constants/parameter-catalog";

/**
 * Notification emails — real parts only.
 *
 * The backend has no Notifications domain yet, so the templates themselves
 * come from mock/notifications.ts. When the backend adds it, implement those
 * methods here (they override the mock ones, see api/index.ts) and delete
 * them from the mock.
 */
export const notificationsApi = {
  /** Sender from the Email parameters, merge fields from the chosen organization. */
  async getEmailPreviewContext(scope = {}) {
    const orgId = scope.organizationId;
    const [platform, own, org] = await Promise.all([
      loadPlatformParameters(),
      orgId ? loadOwnParameters(orgId) : undefined,
      orgId ? request<BackendOrganization>("GET", `/organizations/${encodeURIComponent(orgId)}`) : undefined,
    ]);
    const param = (key: string) => {
      const def = parameterDefinition(key);
      return def ? String(effectiveValue(def, platform, own) ?? "") : "";
    };
    return {
      fromName: param("EMAIL_FROM_NAME"),
      fromAddress: param("EMAIL_FROM_ADDRESS"),
      replyTo: param("EMAIL_REPLY_TO"),
      organization: {
        name: org?.companyName ?? "",
        code: org?.companyCode ?? "",
        address: org?.address ?? "",
        phone: org?.phone ?? org?.mobileNumber ?? "",
        email: org?.email ?? "",
      },
    };
  },
} satisfies Pick<SuperAdminApi, "getEmailPreviewContext">;

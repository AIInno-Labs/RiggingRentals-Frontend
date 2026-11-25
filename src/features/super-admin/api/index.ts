import "server-only";
import type { SuperAdminApi } from "@/features/super-admin/api/contract";
import { dashboardApi } from "@/features/super-admin/api/http/dashboard";
import { notificationsApi } from "@/features/super-admin/api/http/notifications";
import { organizationsApi } from "@/features/super-admin/api/http/organizations";
import { parametersApi } from "@/features/super-admin/api/http/parameters";
import { privilegesApi } from "@/features/super-admin/api/http/privileges";
import { profileApi } from "@/features/super-admin/api/http/profile";
import { mockNotificationsApi } from "@/features/super-admin/api/mock/notifications";

/**
 * The only way pages and Server Actions reach Super Admin data.
 *
 * Real methods call the Rigg Rental Spring Boot API (RIGG_RENTAL_API_URL)
 * as the signed-in Super Admin. Notification emails have no backend yet and
 * come from mock/ — the real modules are spread after it, so a real method
 * always wins. Search for `TODO(backend)` to see what's still pending.
 *
 * Server-side only: never import this from a Client Component.
 */
export const superAdminApi: SuperAdminApi = {
  ...mockNotificationsApi, // TODO(backend): Notifications domain
  ...dashboardApi,
  ...organizationsApi,
  ...privilegesApi,
  ...parametersApi,
  ...notificationsApi,
  ...profileApi,
};

export { ApiError, isApiError } from "@/features/super-admin/api/contract";
export type { SuperAdminApi } from "@/features/super-admin/api/contract";

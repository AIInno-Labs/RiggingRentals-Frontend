import "server-only";
import type { SuperAdminApi } from "@/features/super-admin/api/contract";
import { httpSuperAdminApi } from "@/features/super-admin/api/http/http-api";
import { riggRentalSuperAdminApi } from "@/features/super-admin/api/http/rigg-rental-api";
import { mockSuperAdminApi } from "@/features/super-admin/api/mock/mock-api";

/**
 * The only way pages and Server Actions reach Super Admin data.
 *
 * SUPER_ADMIN_API_MODE=mock (default) uses in-memory sample data.
 * SUPER_ADMIN_API_MODE=http calls the full contract this panel was designed
 *   against (docs/super-admin-api-contract.md) at SUPER_ADMIN_API_URL — no
 *   backend implements this yet.
 * SUPER_ADMIN_API_MODE=rigg-rental calls the real Rigg Rental Spring Boot API
 *   at RIGG_RENTAL_API_URL for Organizations and Privileges; everything else
 *   (dashboard, parameters, notifications, profile/MFA) still falls back to
 *   mock data, since the backend has no equivalent yet — see
 *   src/features/super-admin/api/http/rigg-rental-api.ts.
 *
 * Server-side only: never import this from a Client Component.
 */
export const superAdminApi: SuperAdminApi =
  process.env.SUPER_ADMIN_API_MODE === "http"
    ? httpSuperAdminApi
    : process.env.SUPER_ADMIN_API_MODE === "rigg-rental"
      ? riggRentalSuperAdminApi
      : mockSuperAdminApi;

export { ApiError } from "@/features/super-admin/api/contract";
export type { SuperAdminApi } from "@/features/super-admin/api/contract";

import "server-only";
import type { SuperAdminApi } from "@/features/super-admin/api/contract";
import { riggRentalSuperAdminApi } from "@/features/super-admin/api/http/rigg-rental-api";

/**
 * The only way pages and Server Actions reach Super Admin data.
 *
 * Backed by the real Rigg Rental Spring Boot API (RIGG_RENTAL_API_URL) for
 * Organizations and Privileges, including those two counts on the dashboard.
 * Parameters, notifications, and profile/MFA still fall back to mock data,
 * and the dashboard's service, override, and email tiles stay mock with
 * them — see src/features/super-admin/api/http/rigg-rental-api.ts.
 *
 * Server-side only: never import this from a Client Component.
 */
export const superAdminApi: SuperAdminApi = riggRentalSuperAdminApi;

export { ApiError } from "@/features/super-admin/api/contract";
export type { SuperAdminApi } from "@/features/super-admin/api/contract";

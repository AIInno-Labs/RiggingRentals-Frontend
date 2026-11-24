import "server-only";
import type { SuperAdminApi } from "@/features/super-admin/api/contract";
import { httpSuperAdminApi } from "@/features/super-admin/api/http/http-api";
import { mockSuperAdminApi } from "@/features/super-admin/api/mock/mock-api";

/**
 * The only way pages and Server Actions reach Super Admin data.
 *
 * SUPER_ADMIN_API_MODE=mock (default) uses in-memory sample data.
 * SUPER_ADMIN_API_MODE=http calls the Spring Boot API at SUPER_ADMIN_API_URL.
 *
 * Server-side only: never import this from a Client Component.
 */
export const superAdminApi: SuperAdminApi =
  process.env.SUPER_ADMIN_API_MODE === "http" ? httpSuperAdminApi : mockSuperAdminApi;

export { ApiError } from "@/features/super-admin/api/contract";
export type { SuperAdminApi } from "@/features/super-admin/api/contract";

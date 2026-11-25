import "server-only";
import { cache } from "react";
import { ApiError, type SuperAdminApi } from "@/features/super-admin/api/contract";
import { request } from "@/features/super-admin/api/http/client";
import { type BackendPrivilege, toPrivilege } from "@/features/super-admin/api/rigg-rental-shared";
import type { PrivilegeType } from "@/features/super-admin/types";

/**
 * Privileges — backend: /privileges.
 *
 * Known backend gaps:
 *  - no `description` field: accepted on save, not stored;
 *  - creating a FIELD privilege fails: the backend also needs
 *    `fieldKey`/`accessMode`, which this form doesn't collect yet.
 */

/** GET /privileges */
export const loadPrivileges = cache(() => request<BackendPrivilege[]>("GET", "/privileges"));

async function findByCode(code: string): Promise<BackendPrivilege> {
  const found = (await loadPrivileges()).find((p) => p.privilegeCode === code);
  if (!found) throw new ApiError("NOT_FOUND", `No privilege with code ${code}.`, 404);
  return found;
}

export const privilegesApi = {
  async listPrivileges(filters = {}) {
    const all = (await loadPrivileges()).map(toPrivilege);

    const countsByType: Record<PrivilegeType, number> = { MENU: 0, ACTION: 0, FIELD: 0 };
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
  },

  async createPrivilege(input) {
    await request("POST", "/privileges", {
      body: { privilege: input.label, privilegeCode: input.code, privilegeType: input.type, domain: input.area },
    });
  },

  async updatePrivilege(code, input) {
    const existing = await findByCode(code);
    await request("PUT", `/privileges/${existing.id}`, {
      body: { privilege: input.label, privilegeType: input.type, domain: input.area },
    });
  },

  async setPrivilegeActive(code, active) {
    const existing = await findByCode(code);
    await request("PUT", `/privileges/${existing.id}`, { body: { privilege: existing.privilege, active } });
  },
} satisfies Pick<SuperAdminApi, "listPrivileges" | "createPrivilege" | "updatePrivilege" | "setPrivilegeActive">;

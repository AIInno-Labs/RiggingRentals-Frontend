import "server-only";
import { ApiError, type SuperAdminApi } from "@/features/super-admin/api/contract";
import { request } from "@/features/super-admin/api/http/client";
import {
  effectiveValue,
  loadAllOwnParameters,
  loadOrganizations,
  loadOwnParameters,
  loadPlatformParameters,
  missingKeys,
} from "@/features/super-admin/api/http/loaders";
import { notAvailable } from "@/features/super-admin/api/http/not-available";
import { PARAMETER_GROUPS, parameterDefinition } from "@/features/super-admin/constants/parameter-catalog";
import {
  BACKEND_PARAM_TYPE,
  encodeValue,
  isEmptyValue,
  maskValue,
  parseInput,
} from "@/features/super-admin/lib/parameter-values";
import type { ParameterDefinition, ParameterGroupView } from "@/features/super-admin/types";

/**
 * Application parameters — backend: /admin/parameters (Super Admin only).
 *
 *   GET    /admin/parameters                    platform defaults
 *   GET    /admin/parameters?organizationId=X   X's values merged over the defaults
 *   PUT    /admin/parameters                    upsert by (paramName, organizationId)
 *   DELETE /admin/parameters/{id}               remove a row (used to drop an org's own value)
 *
 * Which parameters exist, their labels and validation come from
 * constants/parameter-catalog.ts; the backend only stores the values.
 */

function definitionFor(key: string): ParameterDefinition {
  const def = parameterDefinition(key);
  if (!def) throw new ApiError("NOT_FOUND", "That parameter no longer exists.", 404);
  return def;
}

export const parametersApi = {
  async getParameters(scope = {}) {
    const orgId = scope.organizationId;
    const [platform, own, allOwn, organizations] = await Promise.all([
      loadPlatformParameters(),
      orgId ? loadOwnParameters(orgId) : undefined,
      // "Organizations with own value" is only shown at platform scope.
      orgId ? undefined : loadAllOwnParameters(),
      orgId ? undefined : loadOrganizations(),
    ]);
    const codeOf = new Map((organizations ?? []).map((o) => [String(o.id), o.companyCode]));
    const missing = new Set(missingKeys(platform, own));

    return PARAMETER_GROUPS.map(
      (g): ParameterGroupView => ({
        id: g.id,
        name: g.name,
        description: g.description,
        enabled: !!effectiveValue(g.items[0], platform, own),
        missingCount: g.items.filter((i) => missing.has(i.key)).length,
        items: g.items.map((def) => {
          const value = effectiveValue(def, platform, own);
          const platformValue = effectiveValue(def, platform);
          const secret = def.type === "secret";
          return {
            ...def,
            value: secret ? null : value,
            maskedValue: secret ? maskValue(value) : null,
            hasValue: !isEmptyValue(value),
            source: own?.has(def.key) ? "organization" : "platform",
            platformDisplay: secret ? maskValue(platformValue) : platformValue,
            overriddenBy: allOwn
              ? [...allOwn.entries()].filter(([, rows]) => rows.has(def.key)).map(([id]) => codeOf.get(id) ?? id)
              : [],
            missing: missing.has(def.key),
          };
        }),
      }),
    );
  },

  async updateParameter(key, rawValue, scope = {}) {
    const def = definitionFor(key);
    const orgId = scope.organizationId;
    const [platform, own] = await Promise.all([loadPlatformParameters(), orgId ? loadOwnParameters(orgId) : undefined]);
    const value = parseInput(def, rawValue, effectiveValue(def, platform, own));
    await request("PUT", "/admin/parameters", {
      body: {
        paramName: def.key,
        paramValue: encodeValue(value),
        paramType: BACKEND_PARAM_TYPE[def.type],
        description: def.label,
        organizationId: orgId ? Number(orgId) : null,
      },
    });
  },

  async resetParameter(key, organizationId) {
    definitionFor(key);
    const row = (await loadOwnParameters(organizationId)).get(key);
    if (row?.id == null) return; // already using the platform value
    await request("DELETE", `/admin/parameters/${row.id}`);
  },

  async testParameterGroup(groupId, scope = {}) {
    const group = PARAMETER_GROUPS.find((g) => g.id === groupId);
    if (!group) throw new ApiError("NOT_FOUND", "That service no longer exists.", 404);
    const orgId = scope.organizationId;
    const [platform, own] = await Promise.all([loadPlatformParameters(), orgId ? loadOwnParameters(orgId) : undefined]);

    // These checks only need the saved values, so they run here.
    if (!effectiveValue(group.items[0], platform, own)) return { ok: false, message: `${group.name} is off. Turn it on first.` };
    const missing = new Set(missingKeys(platform, own));
    const labels = group.items.filter((i) => missing.has(i.key)).map((i) => i.label);
    if (labels.length) {
      return { ok: false, message: `Can't connect to ${group.name}: ${labels.join(", ")} ${labels.length > 1 ? "are" : "is"} empty.` };
    }

    // TODO(backend): POST /admin/parameters/{group}/test?organizationId=  → { ok, message }
    //   return request<ConnectionTestResult>("POST", `/admin/parameters/${groupId}/test`, { query: { organizationId: orgId } });
    return notAvailable(`A live ${group.name} connection test`);
  },
} satisfies Pick<SuperAdminApi, "getParameters" | "updateParameter" | "resetParameter" | "testParameterGroup">;

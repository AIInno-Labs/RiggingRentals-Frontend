"use server";

import { z } from "zod";
import { superAdminApi } from "@/features/super-admin/api";
import { execute, query, runAction } from "@/features/super-admin/actions/run-action";
import { parameterUpdateSchema } from "@/features/super-admin/schemas";
import type { ParameterGroupId } from "@/features/super-admin/types";

const scopeOf = (organizationId?: string) => (organizationId ? { organizationId } : {});

export async function updateParameterAction(key: string, value: string, organizationId?: string) {
  return runAction(parameterUpdateSchema, { key, value, organizationId }, (data) =>
    superAdminApi.updateParameter(data.key, data.value, scopeOf(data.organizationId)),
  );
}

export async function resetParameterAction(key: string, organizationId: string) {
  return execute(() => superAdminApi.resetParameter(z.string().min(1).parse(key), z.string().min(1).parse(organizationId)));
}

export async function testParameterGroupAction(group: ParameterGroupId, organizationId?: string) {
  return query(() =>
    superAdminApi.testParameterGroup(z.enum(["sharepoint", "ai", "email"]).parse(group), scopeOf(organizationId)),
  );
}

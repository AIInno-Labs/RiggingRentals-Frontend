"use server";

import { z } from "zod";
import { superAdminApi } from "@/features/super-admin/api";
import { execute, runAction } from "@/features/super-admin/actions/run-action";
import { createPrivilegeSchema, updatePrivilegeSchema } from "@/features/super-admin/schemas";
import type { CreatePrivilegeInput, UpdatePrivilegeInput } from "@/features/super-admin/types";

const codeSchema = z.string().min(1);

export async function createPrivilegeAction(input: CreatePrivilegeInput) {
  return runAction(createPrivilegeSchema, input, (data) => superAdminApi.createPrivilege(data));
}

export async function updatePrivilegeAction(code: string, input: UpdatePrivilegeInput) {
  return runAction(updatePrivilegeSchema, input, (data) => superAdminApi.updatePrivilege(codeSchema.parse(code), data));
}

export async function setPrivilegeActiveAction(code: string, active: boolean) {
  return execute(() => superAdminApi.setPrivilegeActive(codeSchema.parse(code), active === true));
}

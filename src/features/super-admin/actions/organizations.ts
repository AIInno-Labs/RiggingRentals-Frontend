"use server";

import { z } from "zod";
import { superAdminApi } from "@/features/super-admin/api";
import { execute, query, runAction } from "@/features/super-admin/actions/run-action";
import { createOrganizationSchema, organizationSchema } from "@/features/super-admin/schemas";
import type { CreateOrganizationInput, OrganizationInput } from "@/features/super-admin/types";

const idSchema = z.string().min(1);

export async function createOrganizationAction(input: CreateOrganizationInput) {
  return runAction(createOrganizationSchema, input, (data) => superAdminApi.createOrganization(data));
}

export async function updateOrganizationAction(id: string, input: OrganizationInput) {
  return runAction(organizationSchema, input, (data) => superAdminApi.updateOrganization(idSchema.parse(id), data));
}

export async function setOrganizationActiveAction(id: string, active: boolean) {
  return execute(() => superAdminApi.setOrganizationActive(idSchema.parse(id), active === true));
}

export async function resetOrganizationAdminPasswordAction(id: string) {
  return execute(() => superAdminApi.resetOrganizationAdminPassword(idSchema.parse(id)));
}

/** Read action for the side panel, which opens on the client. */
export async function getOrganizationAction(id: string) {
  return query(() => superAdminApi.getOrganization(idSchema.parse(id)));
}

"use server";

import { z } from "zod";
import { superAdminApi } from "@/features/super-admin/api";
import { execute, query, runAction } from "@/features/super-admin/actions/run-action";
import { emailTemplateUpdateSchema } from "@/features/super-admin/schemas";
import type { UpdateEmailTemplateInput } from "@/features/super-admin/types";

const idSchema = z.string().min(1);
const scopeOf = (organizationId?: string) => (organizationId ? { organizationId } : {});

export async function updateEmailTemplateAction(id: string, input: UpdateEmailTemplateInput, organizationId?: string) {
  return runAction(emailTemplateUpdateSchema, input, (data) =>
    superAdminApi.updateEmailTemplate(
      idSchema.parse(id),
      // Organizations can't change who may turn an email off; that's platform-wide.
      organizationId ? { ...data, adminCanTurnOff: undefined } : data,
      scopeOf(organizationId),
    ),
  );
}

export async function setEmailEnabledAction(id: string, enabled: boolean, organizationId?: string) {
  return execute(() => superAdminApi.setEmailEnabled(idSchema.parse(id), enabled === true, scopeOf(organizationId)));
}

export async function resetEmailTemplateAction(id: string, organizationId: string) {
  return execute(() => superAdminApi.resetEmailTemplate(idSchema.parse(id), idSchema.parse(organizationId)));
}

export async function sendTestEmailAction(id: string, organizationId?: string) {
  return query(() => superAdminApi.sendTestEmail(idSchema.parse(id), scopeOf(organizationId)));
}

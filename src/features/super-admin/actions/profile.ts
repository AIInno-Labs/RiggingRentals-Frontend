"use server";

import { superAdminApi } from "@/features/super-admin/api";
import { execute, query, runAction } from "@/features/super-admin/actions/run-action";
import { changePasswordSchema, mfaCodeSchema, profileSchema } from "@/features/super-admin/schemas";
import type { UpdateProfileInput } from "@/features/super-admin/types";

export async function updateProfileAction(input: UpdateProfileInput) {
  return runAction(profileSchema, input, (data) => superAdminApi.updateProfile(data));
}

export async function changePasswordAction(input: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  return runAction(changePasswordSchema, input, ({ currentPassword, newPassword }) =>
    superAdminApi.changePassword({ currentPassword, newPassword }),
  );
}

export async function startMfaSetupAction() {
  return query(() => superAdminApi.startMfaSetup());
}

export async function confirmMfaAction(code: string) {
  return runAction(mfaCodeSchema, { code }, (data) => superAdminApi.confirmMfa(data.code));
}

export async function disableMfaAction() {
  return execute(() => superAdminApi.disableMfa());
}

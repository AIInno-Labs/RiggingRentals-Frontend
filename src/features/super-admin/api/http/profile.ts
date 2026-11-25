import "server-only";
import type { SuperAdminApi } from "@/features/super-admin/api/contract";
import { loadCurrentUser } from "@/features/super-admin/api/http/loaders";
import { notAvailable } from "@/features/super-admin/api/http/not-available";

/**
 * The signed-in Super Admin's own account — backend: /auth/me (read only).
 * Editing the profile, changing the password and two-step sign-in are
 * waiting on backend endpoints.
 */
export const profileApi = {
  async getProfile() {
    const me = await loadCurrentUser();
    return {
      name: me.displayName || me.username || me.email || "",
      email: me.email ?? "",
      mobile: me.mobileNumber ?? "",
      mfaEnabled: false, // TODO(backend): expose MFA status on /auth/me
    };
  },

  async updateProfile() {
    // TODO(backend): PUT /auth/me  { displayName, mobileNumber }
    return notAvailable("Editing your profile");
  },

  async changePassword() {
    // TODO(backend): POST /auth/me/password  { currentPassword, newPassword }
    return notAvailable("Changing your password");
  },

  async startMfaSetup() {
    // TODO(backend): POST /auth/me/mfa/setup  → { secret, otpauthUri }
    return notAvailable("Two-step sign-in");
  },

  async confirmMfa() {
    // TODO(backend): POST /auth/me/mfa/confirm  { code }
    return notAvailable("Two-step sign-in");
  },

  async disableMfa() {
    // TODO(backend): DELETE /auth/me/mfa
    return notAvailable("Two-step sign-in");
  },
} satisfies Pick<
  SuperAdminApi,
  "getProfile" | "updateProfile" | "changePassword" | "startMfaSetup" | "confirmMfa" | "disableMfa"
>;

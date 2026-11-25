import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isApiError, superAdminApi } from "@/features/super-admin/api";
import { SuperAdminShell } from "@/features/super-admin/components/shell/super-admin-shell";
import { COPY } from "@/features/super-admin/constants/copy";
import { SIGN_OUT_HREF } from "@/features/super-admin/constants/routes";

export const metadata: Metadata = {
  title: `${COPY.shell.title} · Rigging Rentals`,
  robots: { index: false, follow: false },
};

/**
 * Super Admin area. The middleware only lets in requests carrying a
 * Super Admin session cookie (set by the shared /login page); loading the
 * profile here also confirms the backend still accepts that session.
 */
export default async function SuperAdminLayout({ children }: LayoutProps<"/super-admin">) {
  let profile;
  try {
    profile = await superAdminApi.getProfile();
  } catch (error) {
    // Session rejected by the backend: clear it and sign in again.
    if (isApiError(error, "UNAUTHENTICATED") || isApiError(error, "FORBIDDEN")) redirect(SIGN_OUT_HREF);
    throw error;
  }
  const badges = await superAdminApi.getNavBadges();
  return (
    <SuperAdminShell userName={profile.name} badges={badges}>
      {children}
    </SuperAdminShell>
  );
}

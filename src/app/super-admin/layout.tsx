import type { Metadata } from "next";
import { superAdminApi } from "@/features/super-admin/api";
import { SuperAdminShell } from "@/features/super-admin/components/shell/super-admin-shell";
import { COPY } from "@/features/super-admin/constants/copy";

export const metadata: Metadata = {
  title: `${COPY.shell.title} · Rigging Rentals`,
  robots: { index: false, follow: false },
};

/**
 * Super Admin area. Front-end only for now: no sign-in and no Supabase.
 * All data comes from `superAdminApi` (mock data until the Spring Boot API is ready).
 */
export default async function SuperAdminLayout({ children }: LayoutProps<"/super-admin">) {
  const [profile, badges] = await Promise.all([superAdminApi.getProfile(), superAdminApi.getNavBadges()]);
  return (
    <SuperAdminShell userName={profile.name} badges={badges}>
      {children}
    </SuperAdminShell>
  );
}

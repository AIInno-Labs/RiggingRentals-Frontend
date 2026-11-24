import { PortalShell } from "@/components/portal-shell";
import { getCurrentProfile } from "@/features/rbac/get-current-profile";
import { portalTitleForRole } from "@/features/rbac/portal-nav";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <PortalShell
      title={portalTitleForRole(profile.role)}
      role={profile.role}
      fullName={profile.full_name}
    >
      {children}
    </PortalShell>
  );
}

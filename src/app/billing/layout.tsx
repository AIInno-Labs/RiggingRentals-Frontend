import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { getCurrentProfile } from "@/features/rbac/get-current-profile";

export default async function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <PortalShell
      title="Finance desk"
      role={profile.role}
      fullName={profile.full_name}
    >
      {children}
    </PortalShell>
  );
}

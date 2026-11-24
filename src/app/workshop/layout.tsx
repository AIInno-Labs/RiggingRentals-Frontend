import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { getCurrentProfile } from "@/features/rbac/get-current-profile";
import { getWorkshopNavBadges } from "@/features/workshop/get-workshop-nav-badges";

export default async function WorkshopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const navBadges = await getWorkshopNavBadges();

  return (
    <PortalShell
      title="Workshop floor"
      role={profile.role}
      fullName={profile.full_name}
      navBadges={navBadges}
    >
      {children}
    </PortalShell>
  );
}

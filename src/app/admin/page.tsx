import { getDashboardBundle } from "@/features/dashboard/get-fleet-kpis";
import { getFollowUps } from "@/features/dashboard/get-follow-ups";
import { getOpsAnalytics } from "@/features/dashboard/get-ops-analytics";
import { getHirePressure } from "@/features/dashboard/get-hire-pressure";
import { getCurrentProfile } from "@/features/rbac/get-current-profile";
import { SalesDeskHome } from "@/features/orders/components/sales-desk-home";
import { OpsCommandCenter } from "@/features/dashboard/components/ops-command-center";

export default async function AdminHomePage() {
  const profile = await getCurrentProfile();
  if (profile?.role === "sales") {
    return <SalesDeskHome />;
  }

  const [bundle, followUps, analytics, hirePressure] = await Promise.all([
    getDashboardBundle(),
    getFollowUps(),
    getOpsAnalytics(),
    getHirePressure(14, 6),
  ]);

  return (
    <OpsCommandCenter
      analytics={analytics}
      alerts={bundle.alerts}
      followUps={followUps}
      fleetDonut={bundle.fleetDonut}
      pipelineDonut={bundle.pipelineDonut}
      recentOrders={bundle.recentOrders}
      hirePressure={hirePressure}
    />
  );
}

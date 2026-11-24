import { RoutePending } from "@/components/route-pending";
import { COPY } from "@/features/super-admin/constants/copy";

export default function SuperAdminLoading() {
  return <RoutePending label={COPY.common.loading} />;
}

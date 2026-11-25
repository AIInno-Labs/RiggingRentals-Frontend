import { superAdminApi } from "@/features/super-admin/api";
import { OrganizationsTable } from "@/features/super-admin/components/organizations/organizations-table";
import { QUERY } from "@/features/super-admin/constants/routes";
import { firstParam, parseStatus } from "@/features/super-admin/lib/search-params";

export default async function OrganizationsPage({ searchParams }: PageProps<"/super-admin/organizations">) {
  const sp = await searchParams;
  const [organizations, options] = await Promise.all([
    superAdminApi.listOrganizations({ q: firstParam(sp, QUERY.search), status: parseStatus(sp) }),
    superAdminApi.listOrganizationOptions(),
  ]);
  return (
    <OrganizationsTable organizations={organizations} total={options.length} openCreateOnLoad={firstParam(sp, QUERY.create) === "1"} />
  );
}

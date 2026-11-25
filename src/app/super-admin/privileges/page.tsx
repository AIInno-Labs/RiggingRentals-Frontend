import { superAdminApi } from "@/features/super-admin/api";
import { PrivilegesTable } from "@/features/super-admin/components/privileges/privileges-table";
import { QUERY } from "@/features/super-admin/constants/routes";
import { firstParam, parsePrivilegeType, parseStatus } from "@/features/super-admin/lib/search-params";

export default async function PrivilegesPage({ searchParams }: PageProps<"/super-admin/privileges">) {
  const sp = await searchParams;
  const type = parsePrivilegeType(sp);
  const filters = { q: firstParam(sp, QUERY.search), type, status: parseStatus(sp) };
  const list = await superAdminApi.listPrivileges(filters);
  return <PrivilegesTable list={list} type={type} filters={filters} />;
}

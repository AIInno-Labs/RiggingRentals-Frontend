import { superAdminApi } from "@/features/super-admin/api";
import { Panel, EmptyState, PageHeader } from "@/features/super-admin/components/common/layout-parts";
import { ScopeBar } from "@/features/super-admin/components/common/scope-bar";
import { ParameterGroups } from "@/features/super-admin/components/parameters/parameter-groups";
import { COPY } from "@/features/super-admin/constants/copy";
import { parseScope } from "@/features/super-admin/lib/search-params";

const T = COPY.parameters;

export default async function ParametersPage({ searchParams }: PageProps<"/super-admin/parameters">) {
  const sp = await searchParams;
  const options = await superAdminApi.listOrganizationOptions();
  const scope = parseScope(sp, options.map((o) => o.id));
  const organization = options.find((o) => o.id === scope.organizationId);
  const needsPick = scope.mode === "organization" && !organization;
  const groups = needsPick ? [] : await superAdminApi.getParameters({ organizationId: organization?.id });
  const ownCount = groups.reduce((n, g) => n + g.items.filter((i) => i.source === "organization").length, 0);

  return (
    <>
      <PageHeader title={T.title} description={T.description} />
      <ScopeBar
        mode={scope.mode}
        organizationId={organization?.id}
        organizations={options}
        note={{ platform: COPY.scope.notes.parametersPlatform, organization: COPY.scope.notes.parametersOrganization }}
      />
      {needsPick ? (
        <Panel>
          <EmptyState>{COPY.scope.pickFirst(T.pickWhat)}</EmptyState>
        </Panel>
      ) : (
        <>
          {organization ? (
            <p className="mb-3 text-[12.5px] text-muted-foreground">
              <b className="text-foreground">{organization.name}</b> {T.orgSummary(ownCount)}
              {organization.active ? null : T.inactiveOrg}
            </p>
          ) : null}
          <ParameterGroups groups={groups} organization={organization} />
        </>
      )}
    </>
  );
}

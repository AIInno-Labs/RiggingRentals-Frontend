import { superAdminApi } from "@/features/super-admin/api";
import { EmptyState, PageHeader, Panel } from "@/features/super-admin/components/common/layout-parts";
import { ScopeBar } from "@/features/super-admin/components/common/scope-bar";
import { EmailTemplates } from "@/features/super-admin/components/notifications/email-templates";
import { COPY } from "@/features/super-admin/constants/copy";
import { parseScope } from "@/features/super-admin/lib/search-params";

const T = COPY.notifications;

export default async function NotificationsPage({ searchParams }: PageProps<"/super-admin/notifications">) {
  const sp = await searchParams;
  const options = await superAdminApi.listOrganizationOptions();
  const scope = parseScope(sp, options.map((o) => o.id));
  const organization = options.find((o) => o.id === scope.organizationId);
  const needsPick = scope.mode === "organization" && !organization;
  const apiScope = { organizationId: organization?.id };
  const [templates, previewContext] = needsPick
    ? [[], null]
    : await Promise.all([superAdminApi.listEmailTemplates(apiScope), superAdminApi.getEmailPreviewContext(apiScope)]);

  return (
    <>
      <PageHeader title={T.title} description={T.description} />
      <ScopeBar
        mode={scope.mode}
        organizationId={organization?.id}
        organizations={options}
        note={{ platform: COPY.scope.notes.emailsPlatform, organization: COPY.scope.notes.emailsOrganization }}
      />
      {needsPick || !previewContext ? (
        <Panel>
          <EmptyState>{COPY.scope.pickFirst(T.pickWhat)}</EmptyState>
        </Panel>
      ) : (
        <EmailTemplates templates={templates} organization={organization} previewContext={previewContext} />
      )}
    </>
  );
}

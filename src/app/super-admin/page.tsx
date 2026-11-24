import Link from "next/link";
import { superAdminApi } from "@/features/super-admin/api";
import { OrganizationsOverview } from "@/features/super-admin/components/dashboard/organizations-overview";
import { StatTile } from "@/features/super-admin/components/dashboard/stat-tile";
import { COPY } from "@/features/super-admin/constants/copy";
import { SA_ROUTES } from "@/features/super-admin/constants/routes";

const T = COPY.dashboard;

export default async function SuperAdminDashboardPage() {
  const [summary, organizations] = await Promise.all([superAdminApi.getDashboardSummary(), superAdminApi.listOrganizations()]);
  const gaps = summary.missingParameters;
  const links: [string, string][] = [
    [SA_ROUTES.organizations, T.links.organizations],
    [SA_ROUTES.privileges, T.links.privileges],
    [SA_ROUTES.parameters, T.links.parameters],
    [SA_ROUTES.notifications, T.links.emails],
  ];

  return (
    <>
      <section className="steel-panel anim-rise mb-4 rounded-2xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{T.eyebrow}</p>
            <h2 className="text-3xl leading-tight font-semibold">{T.title}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{T.description}</p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            {links.map(([href, label], i) => (
              <span key={href} className="flex gap-2">
                {i > 0 ? <span className="text-muted-foreground">·</span> : null}
                <Link href={href} className="brand-link font-medium">
                  {label}
                </Link>
              </span>
            ))}
          </nav>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-5">
          <StatTile
            label={T.tiles.organizations}
            value={summary.organizations.active}
            hint={T.tiles.organizationsHint(summary.organizations.inactive, summary.organizations.total)}
            href={SA_ROUTES.organizations}
          />
          <StatTile
            label={T.tiles.privileges}
            value={summary.privileges.active}
            hint={T.tiles.privilegesHint(summary.privileges.inactive)}
            href={SA_ROUTES.privileges}
          />
          <StatTile
            label={T.tiles.services}
            value={`${summary.services.enabled.length}/${summary.services.total}`}
            hint={summary.services.enabled.join(" · ") || T.tiles.servicesNone}
            href={SA_ROUTES.parameters}
            tone={gaps ? "alert" : undefined}
          />
          <StatTile
            label={T.tiles.overrides}
            value={summary.parameterOverrides.total}
            hint={T.tiles.overridesHint(summary.parameterOverrides.organizations, gaps)}
            href={SA_ROUTES.parameters}
            tone={gaps ? "alert" : undefined}
          />
          <StatTile
            label={T.tiles.emails}
            value={`${summary.emails.on}/${summary.emails.total}`}
            hint={T.tiles.emailsHint(summary.emails.customisedOrganizations)}
            href={SA_ROUTES.notifications}
          />
        </div>
      </section>
      <OrganizationsOverview organizations={organizations} />
    </>
  );
}

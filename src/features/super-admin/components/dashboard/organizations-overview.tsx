"use client";

import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActiveBadge, ToneBadge } from "@/features/super-admin/components/common/badges";
import { ClickableRow } from "@/features/super-admin/components/common/clickable-row";
import { EmptyState, Panel, PanelHeader, StackedCell } from "@/features/super-admin/components/common/layout-parts";
import { useOrganizationControls } from "@/features/super-admin/components/organizations/use-organization-controls";
import { COPY } from "@/features/super-admin/constants/copy";
import { SA_ROUTES } from "@/features/super-admin/constants/routes";
import type { OrganizationSummary } from "@/features/super-admin/types";

const T = COPY.dashboard.table;

/** Dashboard table of organizations; a row opens the organization side panel. */
export function OrganizationsOverview({ organizations }: { organizations: OrganizationSummary[] }) {
  const controls = useOrganizationControls();

  return (
    <Panel>
      <PanelHeader
        title={T.title}
        subtitle={T.subtitle}
        actions={
          <Link href={SA_ROUTES.organizations} className="brand-link text-[12.5px] font-medium">
            {T.open}
          </Link>
        }
      />
      <div className="px-2 pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{T.columns.organization}</TableHead>
              <TableHead>{T.columns.admin}</TableHead>
              <TableHead>{T.columns.ownValues}</TableHead>
              <TableHead>{T.columns.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.length ? (
              organizations.map((o) => (
                <ClickableRow key={o.id} onOpen={() => controls.openDetails(o.id)} dimmed={!o.active} label={`${COPY.common.open} ${o.name}`}>
                  <TableCell>
                    <StackedCell
                      primary={
                        <>
                          {o.name} <ToneBadge tone="neutral">{o.code}</ToneBadge>
                        </>
                      }
                      secondary={`${o.state} · ${T.added(o.createdAt)}`}
                    />
                  </TableCell>
                  <TableCell>
                    <StackedCell primary={o.admin.name} secondary={o.admin.email} />
                  </TableCell>
                  <TableCell className="text-[12.5px]">
                    {T.parameterCount(o.parameterOverrideCount)}
                    <div className="text-muted-foreground">{T.emailCount(o.customEmailCount)}</div>
                  </TableCell>
                  <TableCell>
                    <ActiveBadge active={o.active} />
                  </TableCell>
                </ClickableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4}>
                  <EmptyState>{T.empty}</EmptyState>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {controls.overlays}
    </Panel>
  );
}

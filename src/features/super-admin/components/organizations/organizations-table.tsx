"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActiveBadge, ToneBadge } from "@/features/super-admin/components/common/badges";
import { ClickableRow } from "@/features/super-admin/components/common/clickable-row";
import { EmptyState, PageHeader, Panel, PanelHeader, StackedCell } from "@/features/super-admin/components/common/layout-parts";
import { UrlSearchInput, UrlStatusSelect, useUrlParams } from "@/features/super-admin/components/common/url-filters";
import { useOrganizationControls } from "@/features/super-admin/components/organizations/use-organization-controls";
import { COPY } from "@/features/super-admin/constants/copy";
import { STATE_TIME_ZONES } from "@/features/super-admin/constants/domain";
import { QUERY } from "@/features/super-admin/constants/routes";
import type { OrganizationSummary } from "@/features/super-admin/types";

const T = COPY.organizations;

/** Organizations page body: filters, table, and all organization overlays. */
export function OrganizationsTable({
  organizations,
  total,
  openCreateOnLoad,
}: {
  organizations: OrganizationSummary[];
  total: number;
  /** Set when arriving from the header's "Add organization" button. */
  openCreateOnLoad: boolean;
}) {
  const controls = useOrganizationControls();
  const { update } = useUrlParams();

  // Open the create dialog once, then drop ?new=1 so a refresh doesn't reopen it.
  useEffect(() => {
    if (!openCreateOnLoad) return;
    controls.openCreate();
    update({ [QUERY.create]: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCreateOnLoad]);

  return (
    <>
      <PageHeader title={T.title} description={T.description} actions={<Button onClick={controls.openCreate}>{T.create}</Button>} />
      <Panel>
        <PanelHeader actions={<span className="self-center text-[12.5px] text-muted-foreground">{COPY.common.showing(organizations.length, total)}</span>}>
          <div className="flex flex-wrap items-center gap-2">
            <UrlSearchInput placeholder={T.searchPlaceholder} ariaLabel={T.searchLabel} />
            <UrlStatusSelect />
          </div>
        </PanelHeader>
        <div className="px-2 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{T.columns.code}</TableHead>
                <TableHead>{T.columns.organization}</TableHead>
                <TableHead>{T.columns.address}</TableHead>
                <TableHead>{T.columns.admin}</TableHead>
                <TableHead>{T.columns.status}</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.length ? (
                organizations.map((o) => (
                  <ClickableRow key={o.id} onOpen={() => controls.openDetails(o.id)} dimmed={!o.active} label={`${COPY.common.open} ${o.name}`}>
                    <TableCell>
                      <ToneBadge tone="dark">{o.code}</ToneBadge>
                    </TableCell>
                    <TableCell>
                      <StackedCell primary={o.name} secondary={`${o.state} · ${STATE_TIME_ZONES[o.state]}`} />
                    </TableCell>
                    <TableCell className="text-[12.5px] whitespace-normal">
                      {o.address}
                      <div className="text-muted-foreground">{[o.phone, o.email].filter(Boolean).join(" · ")}</div>
                    </TableCell>
                    <TableCell>
                      <StackedCell primary={o.admin.name} secondary={o.admin.email} />
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={o.active} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => controls.openEdit(o)}>
                          {COPY.common.edit}
                        </Button>
                        <Button
                          size="sm"
                          variant={o.active ? "destructive" : "outline"}
                          disabled={controls.pending}
                          onClick={() => controls.toggleActive(o)}
                        >
                          {o.active ? COPY.common.deactivate : COPY.common.activate}
                        </Button>
                      </div>
                    </TableCell>
                  </ClickableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState>{T.empty}</EmptyState>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>
      {controls.overlays}
    </>
  );
}

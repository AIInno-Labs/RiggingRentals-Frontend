"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OnOffBadge, ToneBadge } from "@/features/super-admin/components/common/badges";
import { ClickableRow } from "@/features/super-admin/components/common/clickable-row";
import { Panel, PanelHeader } from "@/features/super-admin/components/common/layout-parts";
import { ParameterFormDialog } from "@/features/super-admin/components/parameters/parameter-form-dialog";
import { ParameterValue } from "@/features/super-admin/components/parameters/parameter-value";
import { testParameterGroupAction } from "@/features/super-admin/actions/parameters";
import { COPY } from "@/features/super-admin/constants/copy";
import type { OrganizationOption, ParameterGroupId, ParameterGroupView, ParameterView } from "@/features/super-admin/types";

const T = COPY.parameters;
const displayValue = (p: ParameterView) => (p.type === "secret" ? p.maskedValue : p.value);

/** SharePoint / AI / Email cards for the selected scope. */
export function ParameterGroups({ groups, organization }: { groups: ParameterGroupView[]; organization?: OrganizationOption }) {
  const [editing, setEditing] = useState<{ key: string; open: boolean; seq: number } | null>(null);
  const [testing, startTest] = useTransition();

  const editingGroup = editing ? groups.find((g) => g.items.some((i) => i.key === editing.key)) : undefined;
  const editingParam = editingGroup?.items.find((i) => i.key === editing?.key);
  const openEdit = (key: string) => setEditing((e) => ({ key, open: true, seq: (e?.seq ?? 0) + 1 }));

  function test(groupId: ParameterGroupId) {
    startTest(async () => {
      const result = await testParameterGroupAction(groupId, organization?.id);
      if (!result.success) return void toast.error(result.error.message);
      if (result.data.ok) toast.success(result.data.message);
      else toast.error(result.data.message);
    });
  }

  return (
    <>
      {groups.map((g) => (
        <Panel key={g.id} className="mb-3">
          <PanelHeader
            title={
              <>
                {g.name} <OnOffBadge on={g.enabled} />
                {g.missingCount ? <ToneBadge tone="bad">{T.missing(g.missingCount)}</ToneBadge> : null}
              </>
            }
            subtitle={g.description}
            actions={
              <Button size="sm" variant="outline" disabled={testing} onClick={() => test(g.id)}>
                {T.testConnection}
              </Button>
            }
          />
          <div className="px-2 pb-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{T.columns.parameter}</TableHead>
                  <TableHead>{T.columns.value}</TableHead>
                  <TableHead>{organization ? T.columns.comesFrom : T.columns.overriddenBy}</TableHead>
                  <TableHead className="w-px" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.items.map((p) => (
                  <ClickableRow key={p.key} onOpen={() => openEdit(p.key)} label={`${COPY.common.edit} ${p.label}`}>
                    <TableCell>
                      <div className="font-medium">
                        {p.label}
                        {p.required ? <span className="font-normal text-muted-foreground"> *</span> : null}
                      </div>
                      <div className="font-mono text-[11.5px] text-muted-foreground">{p.key}</div>
                    </TableCell>
                    <TableCell className="max-w-[420px]">
                      <ParameterValue definition={p} value={displayValue(p)} />
                      {p.missing ? <ToneBadge tone="bad" className="ml-1">{COPY.common.required}</ToneBadge> : null}
                    </TableCell>
                    <TableCell>
                      {organization ? (
                        p.source === "organization" ? (
                          <ToneBadge tone="brand">{organization.name}</ToneBadge>
                        ) : (
                          <span className="text-[12.5px] text-muted-foreground">{COPY.common.platform}</span>
                        )
                      ) : p.overriddenBy.length ? (
                        p.overriddenBy.map((code) => (
                          <ToneBadge key={code} tone="neutral">
                            {code}
                          </ToneBadge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">{COPY.common.none}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openEdit(p.key)}>
                        {COPY.common.edit}
                      </Button>
                    </TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      ))}

      {editing && editingParam && editingGroup ? (
        <ParameterFormDialog
          key={editing.seq}
          parameter={editingParam}
          groupName={editingGroup.name}
          organization={organization}
          open={editing.open}
          onOpenChange={(open) => setEditing((e) => (e ? { ...e, open } : e))}
        />
      ) : null}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToneBadge } from "@/features/super-admin/components/common/badges";
import { ClickableRow } from "@/features/super-admin/components/common/clickable-row";
import { Panel, PanelHeader, StackedCell } from "@/features/super-admin/components/common/layout-parts";
import { EmailFormDialog, whenText } from "@/features/super-admin/components/notifications/email-form-dialog";
import { setEmailEnabledAction } from "@/features/super-admin/actions/notifications";
import { COPY } from "@/features/super-admin/constants/copy";
import { EMAIL_GROUPS, EMAIL_RECIPIENT_LABELS } from "@/features/super-admin/constants/domain";
import type { EmailPreviewContext, EmailTemplate, OrganizationOption } from "@/features/super-admin/types";
import { cn } from "@/lib/utils";

const T = COPY.notifications;

/** Emails grouped by section, with on/off switches and the edit dialog. */
export function EmailTemplates({
  templates,
  organization,
  previewContext,
}: {
  templates: EmailTemplate[];
  organization?: OrganizationOption;
  previewContext: EmailPreviewContext;
}) {
  const [editing, setEditing] = useState<{ id: string; open: boolean; seq: number } | null>(null);
  const [toggling, startToggle] = useTransition();
  const editingTemplate = templates.find((t) => t.id === editing?.id);
  const openEdit = (id: string) => setEditing((e) => ({ id, open: true, seq: (e?.seq ?? 0) + 1 }));
  const orgName = organization?.name ?? null;

  function toggle(t: EmailTemplate, enabled: boolean) {
    startToggle(async () => {
      const result = await setEmailEnabledAction(t.id, enabled, organization?.id);
      if (result.success) toast.success(T.toast.toggled(t.name, enabled, orgName));
      else toast.error(result.error.message);
    });
  }

  const on = templates.filter((t) => t.enabled).length;
  const customCount = templates.filter((t) => t.custom).length;

  return (
    <>
      <p className="mb-3 text-[12.5px] text-muted-foreground">
        {organization ? T.summaryOrganization(on, templates.length, organization.name, customCount) : T.summaryPlatform(on, templates.length)}
      </p>

      {EMAIL_GROUPS.map((group) => {
        const rows = templates.filter((t) => t.group === group.id);
        if (!rows.length) return null;
        return (
          <Panel key={group.id} className="mb-3">
            <PanelHeader title={group.title} subtitle={group.subtitle} />
            <div className="px-2 pb-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{T.columns.email}</TableHead>
                    <TableHead>{T.columns.when}</TableHead>
                    <TableHead>{T.columns.to}</TableHead>
                    <TableHead>{T.columns.attachment}</TableHead>
                    <TableHead>{organization ? T.columns.version : T.columns.adminCanTurnOff}</TableHead>
                    <TableHead>{T.columns.on}</TableHead>
                    <TableHead className="w-px" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((t) => (
                    <ClickableRow key={t.id} onOpen={() => openEdit(t.id)} label={`${COPY.common.edit} ${t.name}`}>
                      <TableCell className={cn(!t.enabled && "opacity-55")}>
                        <StackedCell primary={t.name} secondary={t.mode === "manual" ? T.staffClicksSend : T.automatic} />
                      </TableCell>
                      <TableCell className={cn("text-[12.5px] whitespace-normal", !t.enabled && "opacity-55")}>{whenText(t)}</TableCell>
                      <TableCell className={cn("whitespace-normal", !t.enabled && "opacity-55")}>
                        {t.recipients.map((r) => (
                          <ToneBadge key={r} tone="neutral">
                            {EMAIL_RECIPIENT_LABELS[r]}
                          </ToneBadge>
                        ))}
                      </TableCell>
                      <TableCell className="text-[12.5px]">{t.attachment || <span className="text-muted-foreground">{COPY.common.none}</span>}</TableCell>
                      <TableCell>
                        {organization ? (
                          t.custom ? (
                            <ToneBadge tone="brand">{T.custom}</ToneBadge>
                          ) : (
                            <span className="text-[12.5px] text-muted-foreground">{COPY.common.platform}</span>
                          )
                        ) : (
                          <ToneBadge tone={t.adminCanTurnOff ? "ok" : "off"}>{t.adminCanTurnOff ? COPY.common.yes : COPY.common.no}</ToneBadge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={t.enabled}
                          disabled={toggling}
                          aria-label={T.toggleLabel(t.name)}
                          onCheckedChange={(checked) => toggle(t, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => openEdit(t.id)}>
                          {COPY.common.edit}
                        </Button>
                      </TableCell>
                    </ClickableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        );
      })}

      {editing && editingTemplate ? (
        <EmailFormDialog
          key={editing.seq}
          template={editingTemplate}
          organization={organization}
          previewContext={previewContext}
          open={editing.open}
          onOpenChange={(open) => setEditing((e) => (e ? { ...e, open } : e))}
        />
      ) : null}
    </>
  );
}

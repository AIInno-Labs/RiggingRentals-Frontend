"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActiveBadge, PrivilegeTypeBadge } from "@/features/super-admin/components/common/badges";
import { ClickableRow } from "@/features/super-admin/components/common/clickable-row";
import { Segmented } from "@/features/super-admin/components/common/form-parts";
import { DetailList, EmptyState, Note, PageHeader, Panel, PanelHeader, StackedCell } from "@/features/super-admin/components/common/layout-parts";
import { ConfirmDialog, SidePanel } from "@/features/super-admin/components/common/overlays";
import { UrlSearchInput, UrlStatusSelect, useUrlParams } from "@/features/super-admin/components/common/url-filters";
import { PrivilegeFormDialog } from "@/features/super-admin/components/privileges/privilege-form-dialog";
import { setPrivilegeActiveAction } from "@/features/super-admin/actions/privileges";
import { listPrivilegesDirect } from "@/features/super-admin/api/client/browser-api";
import { COPY } from "@/features/super-admin/constants/copy";
import { PRIVILEGE_TYPES, PRIVILEGE_TYPE_ORDER } from "@/features/super-admin/constants/domain";
import { QUERY } from "@/features/super-admin/constants/routes";
import type { Privilege, PrivilegeFilters, PrivilegeList, PrivilegeType } from "@/features/super-admin/types";

const T = COPY.privileges;

export function PrivilegesTable({
  list: initialList,
  type,
  filters,
}: {
  list: PrivilegeList;
  type: PrivilegeType | "all";
  /** Re-fetched client-side on mount so the call is visible in DevTools — see browser-api.ts. */
  filters: PrivilegeFilters;
}) {
  const { update } = useUrlParams();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; privilege?: Privilege; key: number }>({ open: false, key: 0 });
  const [confirming, setConfirming] = useState<Privilege | null>(null);
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState(initialList);

  // The page above already fetched this server-side for first paint (and
  // again after any mutation, via revalidatePath — that's what updates
  // `initialList`). This re-fetches the same data directly from the browser
  // to the Rigg Rental backend on top of that, purely so the call is visible
  // in the Network tab — see browser-api.ts.
  useEffect(() => {
    setList(initialList);
    listPrivilegesDirect(filters)
      .then(setList)
      .catch((err) => console.error("[super-admin] direct privileges fetch failed", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialList, filters.q, filters.type, filters.status]);

  // Read from the latest list so the panel reflects saved changes.
  const selected = list.items.find((p) => p.code === selectedCode) ?? null;
  const openForm = (privilege?: Privilege) => setForm((f) => ({ open: true, privilege, key: f.key + 1 }));

  function setActive(p: Privilege, active: boolean) {
    startTransition(async () => {
      const result = await setPrivilegeActiveAction(p.code, active);
      if (!result.success) return void toast.error(result.error.message);
      toast.success(active ? T.toast.activated(p.code) : T.toast.deactivated(p.code));
      setConfirming(null);
    });
  }
  const toggleActive = (p: Privilege) => (p.active ? setConfirming(p) : setActive(p, true));

  const typeOptions = (["all", ...PRIVILEGE_TYPE_ORDER] as const).map((t) => ({
    value: t,
    label: (
      <>
        {t === "all" ? T.allTypes : PRIVILEGE_TYPES[t].label}{" "}
        <span className="text-muted-foreground">{t === "all" ? list.total : list.countsByType[t]}</span>
      </>
    ),
  }));

  return (
    <>
      <PageHeader title={T.title} description={T.description} actions={<Button onClick={() => openForm()}>{T.create}</Button>} />
      <Panel>
        <PanelHeader actions={<span className="self-center text-[12.5px] text-muted-foreground">{COPY.common.showing(list.items.length, list.total)}</span>}>
          <div className="flex flex-wrap items-center gap-2">
            <UrlSearchInput placeholder={T.searchPlaceholder} ariaLabel={T.searchLabel} />
            <Segmented<PrivilegeType | "all">
              ariaLabel={T.columns.type}
              value={type}
              options={typeOptions}
              onChange={(t) => update({ [QUERY.type]: t === "all" ? null : t })}
            />
            <UrlStatusSelect />
          </div>
        </PanelHeader>
        <div className="px-2 pb-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{T.columns.code}</TableHead>
                <TableHead>{T.columns.allows}</TableHead>
                <TableHead>{T.columns.type}</TableHead>
                <TableHead>{T.columns.area}</TableHead>
                <TableHead>{T.columns.status}</TableHead>
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.items.length ? (
                list.items.map((p) => (
                  <ClickableRow key={p.code} onOpen={() => setSelectedCode(p.code)} dimmed={!p.active} label={`${COPY.common.open} ${p.label}`}>
                    <TableCell className="font-mono text-[12.5px]">{p.code}</TableCell>
                    <TableCell>
                      <StackedCell primary={p.label} secondary={p.description || undefined} />
                    </TableCell>
                    <TableCell>
                      <PrivilegeTypeBadge type={p.type} />
                    </TableCell>
                    <TableCell>{p.area}</TableCell>
                    <TableCell>
                      <ActiveBadge active={p.active} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openForm(p)}>
                          {COPY.common.edit}
                        </Button>
                        <Button size="sm" variant={p.active ? "destructive" : "outline"} disabled={pending} onClick={() => toggleActive(p)}>
                          {p.active ? COPY.common.deactivate : COPY.common.activate}
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
      <p className="mt-2.5 text-[12.5px] text-muted-foreground">{T.footnote}</p>

      <SidePanel
        open={!!selected}
        onOpenChange={(open) => !open && setSelectedCode(null)}
        title={selected?.label ?? T.title}
        subtitle={selected ? <span className="font-mono">{selected.code}</span> : undefined}
        footer={
          selected ? (
            <>
              <Button variant={selected.active ? "destructive" : "outline"} disabled={pending} onClick={() => toggleActive(selected)}>
                {selected.active ? COPY.common.deactivate : COPY.common.activate}
              </Button>
              <span className="flex-1" />
              <Button onClick={() => openForm(selected)}>{COPY.common.edit}</Button>
            </>
          ) : null
        }
      >
        {selected ? <PrivilegeDetails privilege={selected} /> : null}
      </SidePanel>

      <PrivilegeFormDialog
        key={form.key}
        open={form.open}
        privilege={form.privilege}
        areas={list.areas}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
      />

      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming ? T.confirmDeactivate.title(confirming.code) : ""}
        body={T.confirmDeactivate.body}
        confirmLabel={T.confirmDeactivate.confirm}
        destructive
        pending={pending}
        onConfirm={() => confirming && setActive(confirming, false)}
      />
    </>
  );
}

function PrivilegeDetails({ privilege: p }: { privilege: Privilege }) {
  const F = T.sheet.fields;
  return (
    <>
      <DetailList
        rows={[
          [F.code, <span key="c" className="font-mono">{p.code}</span>],
          [F.allows, p.label],
          [
            F.type,
            <span key="t">
              <PrivilegeTypeBadge type={p.type} /> <span className="text-[12.5px] text-muted-foreground">{PRIVILEGE_TYPES[p.type].meaning}</span>
            </span>,
          ],
          [F.area, p.area],
          [F.description, p.description],
          [F.status, <ActiveBadge key="s" active={p.active} />],
          [F.added, p.createdAt],
        ]}
      />
      <Note tone="muted" className="mt-3.5">
        {p.active ? T.sheet.activeNote : T.sheet.inactiveNote}
      </Note>
    </>
  );
}

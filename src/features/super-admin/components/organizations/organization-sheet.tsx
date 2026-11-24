"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ActiveBadge, ToneBadge } from "@/features/super-admin/components/common/badges";
import { DetailList, SectionTitle } from "@/features/super-admin/components/common/layout-parts";
import { SidePanel } from "@/features/super-admin/components/common/overlays";
import { RoutePending } from "@/components/route-pending";
import { getOrganizationAction, resetOrganizationAdminPasswordAction } from "@/features/super-admin/actions/organizations";
import { COPY } from "@/features/super-admin/constants/copy";
import { STATE_TIME_ZONES } from "@/features/super-admin/constants/domain";
import { SA_ROUTES } from "@/features/super-admin/constants/routes";
import { scopedHref } from "@/features/super-admin/lib/search-params";
import type { Organization, OrganizationDetail } from "@/features/super-admin/types";

const T = COPY.organizations.sheet;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Loads one organization's set-up details when opened. */
export function OrganizationSheet({
  organizationId,
  reloadKey,
  onClose,
  onEdit,
  onToggleActive,
}: {
  organizationId: string | null;
  /** Bump after a change so the panel reloads. */
  reloadKey: number;
  onClose: () => void;
  onEdit: (organization: Organization) => void;
  onToggleActive: (organization: Organization) => void;
}) {
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, startReset] = useTransition();

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    getOrganizationAction(organizationId).then((result) => {
      if (cancelled) return;
      setDetail(result.success ? result.data : null);
      setError(result.success ? null : result.error.message);
    });
    return () => {
      cancelled = true;
    };
  }, [organizationId, reloadKey]);

  // Don't show a previous organization's details while the next one loads.
  const current = detail?.id === organizationId ? detail : null;

  function resetPassword(o: OrganizationDetail) {
    startReset(async () => {
      const result = await resetOrganizationAdminPasswordAction(o.id);
      if (result.success) toast.success(COPY.organizations.toast.passwordReset(result.data.email));
      else toast.error(result.error.message);
    });
  }

  return (
    <SidePanel
      open={!!organizationId}
      onOpenChange={(open) => !open && onClose()}
      title={current?.name ?? COPY.organizations.title}
      subtitle={current ? T.subtitle(current.active) : undefined}
      footer={
        current ? (
          <>
            <Button variant={current.active ? "destructive" : "outline"} onClick={() => onToggleActive(current)}>
              {current.active ? COPY.common.deactivate : COPY.common.activate}
            </Button>
            <Button variant="outline" disabled={resetting} onClick={() => resetPassword(current)}>
              {T.resetPassword}
            </Button>
            <span className="flex-1" />
            <Button onClick={() => onEdit(current)}>{T.edit}</Button>
          </>
        ) : null
      }
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : !current ? (
        <RoutePending label={COPY.common.loading} />
      ) : (
        <OrganizationDetails detail={current} onNavigate={onClose} />
      )}
    </SidePanel>
  );
}

function OrganizationDetails({ detail: o, onNavigate }: { detail: OrganizationDetail; onNavigate: () => void }) {
  const F = T.fields;
  return (
    <>
      <SectionTitle>{T.organizationSection}</SectionTitle>
      <DetailList
        rows={[
          [F.code, <ToneBadge key="c" tone="dark">{o.code}</ToneBadge>],
          [F.status, <ActiveBadge key="s" active={o.active} />],
          [F.state, o.state],
          [F.timeZone, STATE_TIME_ZONES[o.state]],
          [F.address, o.address],
          [F.phone, o.phone],
          [F.email, o.email],
          [F.created, o.createdAt],
        ]}
      />

      <SectionTitle>{T.adminSection}</SectionTitle>
      <div className="mb-3 flex items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-brand font-display text-lg font-bold text-brand-ink">
          {initials(o.admin.name)}
        </div>
        <div>
          <div className="font-medium">{o.admin.name}</div>
          <div className="text-[12.5px] text-muted-foreground">{o.admin.email}</div>
        </div>
      </div>
      <DetailList rows={[[F.mobile, o.admin.phone]]} />

      <SectionTitle>{T.settingsSection(o.name)}</SectionTitle>
      <div className="grid gap-2">
        <SettingsLink
          title={T.parameters}
          hint={
            <>
              {T.parametersHint(o.parameterOverrideCount)}
              {o.missingParameterCount ? <span className="text-destructive"> · {T.parametersMissing(o.missingParameterCount)}</span> : null}
            </>
          }
          href={scopedHref(SA_ROUTES.parameters, o.id)}
          onNavigate={onNavigate}
        />
        <SettingsLink
          title={T.emails}
          hint={T.emailsHint(o.customEmailCount, o.emailsOnCount)}
          href={scopedHref(SA_ROUTES.notifications, o.id)}
          onNavigate={onNavigate}
        />
      </div>
    </>
  );
}

function SettingsLink({ title, hint, href, onNavigate }: { title: string; hint: React.ReactNode; href: string; onNavigate: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href={href} onClick={onNavigate}>
          {COPY.common.open}
        </Link>
      </Button>
    </div>
  );
}

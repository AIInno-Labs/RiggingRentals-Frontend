"use client";

import { Segmented, NativeSelect } from "@/features/super-admin/components/common/form-parts";
import { useUrlParams } from "@/features/super-admin/components/common/url-filters";
import { COPY } from "@/features/super-admin/constants/copy";
import { QUERY } from "@/features/super-admin/constants/routes";
import type { OrganizationOption, ScopeMode } from "@/features/super-admin/types";

/**
 * Platform / Organization switch. Choosing Organization reveals an
 * organization picker. The choice lives in the URL (?scope=&org=).
 */
export function ScopeBar({
  mode,
  organizationId,
  organizations,
  note,
}: {
  mode: ScopeMode;
  organizationId?: string;
  organizations: OrganizationOption[];
  note: { platform: string; organization: string };
}) {
  const { update } = useUrlParams();

  return (
    <div className="steel-panel mb-4 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-2xl px-4 py-3">
      <div className="grid min-w-0 gap-1.5">
        <span className="text-xs leading-none font-medium tracking-wide text-muted-foreground uppercase">{COPY.scope.label}</span>
        <Segmented<ScopeMode>
          ariaLabel={COPY.scope.label}
          value={mode}
          options={[
            { value: "platform", label: COPY.scope.platform },
            { value: "organization", label: COPY.scope.organization },
          ]}
          onChange={(next) =>
            update({ [QUERY.scope]: next === "platform" ? null : next, [QUERY.organization]: next === "platform" ? null : organizationId })
          }
        />
      </div>

      {mode === "organization" ? (
        <div className="grid w-full min-w-0 gap-1.5 sm:w-auto">
          <label htmlFor="scope-org" className="text-xs leading-none font-medium tracking-wide text-muted-foreground uppercase">
            {COPY.scope.organizationLabel}
          </label>
          <NativeSelect
            id="scope-org"
            className="w-full sm:w-[280px]"
            value={organizationId ?? ""}
            onChange={(e) => update({ [QUERY.organization]: e.target.value || null })}
          >
            <option value="">{COPY.scope.pickOrganization}</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.code}
                {o.active ? "" : COPY.scope.inactiveSuffix}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      <p className="flex-[1_1_240px] pb-2 text-[12.5px] text-muted-foreground">
        {mode === "platform" ? note.platform : note.organization}
      </p>
    </div>
  );
}

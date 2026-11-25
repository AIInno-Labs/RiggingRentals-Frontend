"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Field, FieldRow, NativeSelect } from "@/features/super-admin/components/common/form-parts";
import { Note, SectionTitle } from "@/features/super-admin/components/common/layout-parts";
import { FormDialog } from "@/features/super-admin/components/common/overlays";
import { ToneBadge } from "@/features/super-admin/components/common/badges";
import { createOrganizationAction, updateOrganizationAction } from "@/features/super-admin/actions/organizations";
import { COPY } from "@/features/super-admin/constants/copy";
import { AUSTRALIAN_STATES, VALIDATION } from "@/features/super-admin/constants/domain";
import type { AustralianState, Organization, OrganizationInput } from "@/features/super-admin/types";

const T = COPY.organizations.form;
const get = (fd: FormData, key: string) => String(fd.get(key) ?? "");

/**
 * Create (organization + Admin) or edit (organization details only).
 * Render with a `key` per organization so fields reset to its saved values.
 */
export function OrganizationFormDialog({
  organization,
  open,
  onOpenChange,
  onSaved,
}: {
  /** Omit to create a new organization. */
  organization?: Organization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const isNew = !organization;
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState(organization?.code ?? "");
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData) {
    setError(null);
    const details: OrganizationInput = {
      name: get(fd, "name"),
      code: get(fd, "code"),
      state: get(fd, "state") as AustralianState,
      address: get(fd, "address"),
      phone: get(fd, "phone"),
      email: get(fd, "email"),
    };
    startTransition(async () => {
      const result = isNew
        ? await createOrganizationAction({
            ...details,
            admin: {
              name: get(fd, "adminName"),
              email: get(fd, "adminEmail"),
              phone: get(fd, "adminPhone"),
              temporaryPassword: get(fd, "password"),
            },
          })
        : await updateOrganizationAction(organization.id, details);
      if (!result.success) return setError(result.error.message);
      toast.success(
        isNew
          ? COPY.organizations.toast.created(result.data.name, result.data.admin.name)
          : COPY.organizations.toast.updated(result.data.name),
      );
      onOpenChange(false);
      onSaved?.();
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
      title={isNew ? T.createTitle : T.editTitle(organization.name)}
      subtitle={isNew ? T.createSubtitle : <ToneBadge tone="dark">{organization.code}</ToneBadge>}
      error={error}
      pending={pending}
      submitLabel={isNew ? T.submitCreate : COPY.common.saveChanges}
      onSubmit={submit}
    >
      <SectionTitle>{T.detailsSection}</SectionTitle>
      <FieldRow>
        <Field label={T.name} htmlFor="org-name" required>
          <Input id="org-name" name="name" defaultValue={organization?.name} placeholder={T.namePlaceholder} autoFocus />
        </Field>
        <Field label={T.code} htmlFor="org-code" required hint={T.codeHint(code.toUpperCase())}>
          <Input
            id="org-code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={5}
            placeholder={T.codePlaceholder}
            className="font-mono uppercase"
          />
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label={T.state} htmlFor="org-state" required hint={T.stateHint}>
          <NativeSelect id="org-state" name="state" defaultValue={organization?.state ?? "WA"} className="h-8 w-full">
            {AUSTRALIAN_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={T.phone} htmlFor="org-phone">
          <Input id="org-phone" name="phone" defaultValue={organization?.phone} />
        </Field>
      </FieldRow>
      <Field label={T.address} htmlFor="org-address" required hint={T.addressHint}>
        <Input id="org-address" name="address" defaultValue={organization?.address} placeholder={T.addressPlaceholder} />
      </Field>
      <Field label={T.email} htmlFor="org-email">
        <Input id="org-email" name="email" type="email" defaultValue={organization?.email} />
      </Field>

      <SectionTitle>{T.adminSection}</SectionTitle>
      {isNew ? (
        <>
          <p className="-mt-1 mb-3 text-[12.5px] text-muted-foreground">{T.adminIntro}</p>
          <FieldRow>
            <Field label={T.adminName} htmlFor="org-admin-name" required>
              <Input id="org-admin-name" name="adminName" autoComplete="off" />
            </Field>
            <Field label={T.adminEmail} htmlFor="org-admin-email" required>
              <Input id="org-admin-email" name="adminEmail" type="email" autoComplete="off" />
            </Field>
          </FieldRow>
          <Field label={T.adminMobile} htmlFor="org-admin-phone" className="max-w-[260px]">
            <Input id="org-admin-phone" name="adminPhone" />
          </Field>
          <Field
            label={
              <>
                {T.tempPassword} * <span className="font-normal text-muted-foreground">{T.tempPasswordMin}</span>
              </>
            }
            htmlFor="org-admin-password"
            hint={T.tempPasswordHint}
          >
            <Input id="org-admin-password" name="password" type="password" autoComplete="new-password" minLength={VALIDATION.minPasswordLength} />
          </Field>
        </>
      ) : (
        <Note tone="muted">
          <b>{organization.admin.name}</b> · {organization.admin.email}
          {organization.admin.phone ? ` · ${organization.admin.phone}` : null}
          <div className="mt-1 text-[12.5px] text-muted-foreground">{T.adminLocked}</div>
        </Note>
      )}
    </FormDialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldRow, Segmented } from "@/features/super-admin/components/common/form-parts";
import { FormDialog } from "@/features/super-admin/components/common/overlays";
import { createPrivilegeAction, updatePrivilegeAction } from "@/features/super-admin/actions/privileges";
import { COPY } from "@/features/super-admin/constants/copy";
import { PRIVILEGE_TYPES, PRIVILEGE_TYPE_ORDER } from "@/features/super-admin/constants/domain";
import type { Privilege, PrivilegeType } from "@/features/super-admin/types";

const T = COPY.privileges.form;
const get = (fd: FormData, key: string) => String(fd.get(key) ?? "");

/** Create or edit a privilege. Render with a `key` per privilege. */
export function PrivilegeFormDialog({
  privilege,
  areas,
  open,
  onOpenChange,
  onSaved,
}: {
  privilege?: Privilege;
  /** Existing areas, suggested while typing. */
  areas: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const isNew = !privilege;
  const [type, setType] = useState<PrivilegeType>(privilege?.type ?? "ACTION");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData) {
    setError(null);
    const fields = { label: get(fd, "label"), type, area: get(fd, "area"), description: get(fd, "description") };
    startTransition(async () => {
      const result = isNew
        ? await createPrivilegeAction({ code: get(fd, "code"), ...fields })
        : await updatePrivilegeAction(privilege.code, fields);
      if (!result.success) return setError(result.error.message);
      toast.success(isNew ? COPY.privileges.toast.created(get(fd, "code").trim().toUpperCase()) : COPY.privileges.toast.updated(fields.label.trim()));
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
      title={isNew ? T.createTitle : T.editTitle(privilege.label)}
      subtitle={isNew ? T.createSubtitle : <span className="font-mono">{privilege.code}</span>}
      error={error}
      pending={pending}
      submitLabel={isNew ? T.submitCreate : COPY.common.saveChanges}
      onSubmit={submit}
    >
      <FieldRow>
        <Field label={T.code} htmlFor="priv-code" required hint={isNew ? T.codeHintNew : T.codeHintLocked}>
          <Input
            id="priv-code"
            name="code"
            defaultValue={privilege?.code}
            disabled={!isNew}
            placeholder={T.codePlaceholder}
            className="font-mono uppercase"
            autoFocus={isNew}
          />
        </Field>
        <Field label={T.area} htmlFor="priv-area" required hint={T.areaHint}>
          <Input id="priv-area" name="area" defaultValue={privilege?.area} list="priv-areas" placeholder={T.areaPlaceholder} />
          <datalist id="priv-areas">
            {areas.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
      </FieldRow>
      <Field label={T.label} htmlFor="priv-label" required>
        <Input id="priv-label" name="label" defaultValue={privilege?.label} placeholder={T.labelPlaceholder} />
      </Field>
      <Field label={T.type} required hint={T.typeHint}>
        <Segmented<PrivilegeType>
          ariaLabel={T.type}
          value={type}
          onChange={setType}
          options={PRIVILEGE_TYPE_ORDER.map((t) => ({ value: t, label: PRIVILEGE_TYPES[t].label }))}
        />
      </Field>
      <Field label={T.description} htmlFor="priv-description">
        <Textarea id="priv-description" name="description" rows={3} defaultValue={privilege?.description} placeholder={T.descriptionPlaceholder} />
      </Field>
    </FormDialog>
  );
}

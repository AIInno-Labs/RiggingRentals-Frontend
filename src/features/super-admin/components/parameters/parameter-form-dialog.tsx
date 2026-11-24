"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, Segmented } from "@/features/super-admin/components/common/form-parts";
import { Note } from "@/features/super-admin/components/common/layout-parts";
import { FormDialog } from "@/features/super-admin/components/common/overlays";
import { ParameterValue } from "@/features/super-admin/components/parameters/parameter-value";
import { resetParameterAction, updateParameterAction } from "@/features/super-admin/actions/parameters";
import { COPY } from "@/features/super-admin/constants/copy";
import type { OrganizationOption, ParameterView } from "@/features/super-admin/types";

const T = COPY.parameters.form;

/** Edit one parameter at platform or organization scope. Render with a `key` per parameter. */
export function ParameterFormDialog({
  parameter: p,
  groupName,
  organization,
  open,
  onOpenChange,
}: {
  parameter: ParameterView;
  groupName: string;
  /** Set for organization scope. */
  organization?: OrganizationOption;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [flag, setFlag] = useState<"true" | "false">(p.value === true ? "true" : "false");
  const [pending, startTransition] = useTransition();
  const ownValue = !!organization && p.source === "organization";

  function save(fd: FormData) {
    setError(null);
    const value = p.type === "boolean" ? flag : String(fd.get("value") ?? "");
    startTransition(async () => {
      const result = await updateParameterAction(p.key, value, organization?.id);
      if (!result.success) return setError(result.error.message);
      toast.success(organization ? COPY.parameters.toast.savedOrganization(p.label, organization.name) : COPY.parameters.toast.savedPlatform(p.label));
      onOpenChange(false);
    });
  }

  function usePlatformValue() {
    if (!organization) return;
    startTransition(async () => {
      const result = await resetParameterAction(p.key, organization.id);
      if (!result.success) return setError(result.error.message);
      toast.success(COPY.parameters.toast.reset(p.label, organization.name));
      onOpenChange(false);
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={p.label}
      subtitle={organization ? T.organizationSubtitle(organization.name) : T.platformSubtitle}
      error={error}
      pending={pending}
      submitLabel={COPY.common.save}
      onSubmit={save}
      footerStart={
        ownValue ? (
          <Button type="button" variant="outline" disabled={pending} onClick={usePlatformValue}>
            {T.usePlatform}
          </Button>
        ) : null
      }
    >
      <Note tone={ownValue ? "brand" : "muted"} className="mb-3.5">
        {organization ? (
          <>
            <b>{organization.name}</b>{" "}
            {ownValue ? (
              <>
                {T.ownValueNote} <ParameterValue definition={p} value={p.platformDisplay} />
              </>
            ) : (
              T.inheritNote
            )}
          </>
        ) : (
          T.platformNote(p.overriddenBy.length)
        )}
      </Note>

      <Field label={p.label} htmlFor="param-value" required={p.required} hint={p.hint}>
        <ParameterInput parameter={p} flag={flag} onFlagChange={setFlag} />
      </Field>
      <p className="text-[12.5px] text-muted-foreground">{T.keyLine(p.key, groupName)}</p>
    </FormDialog>
  );
}

function ParameterInput({
  parameter: p,
  flag,
  onFlagChange,
}: {
  parameter: ParameterView;
  flag: "true" | "false";
  onFlagChange: (v: "true" | "false") => void;
}) {
  switch (p.type) {
    case "boolean":
      return (
        <Segmented<"true" | "false">
          ariaLabel={p.label}
          value={flag}
          onChange={onFlagChange}
          options={[
            { value: "true", label: COPY.common.on },
            { value: "false", label: COPY.common.off },
          ]}
        />
      );
    case "select":
      return (
        <NativeSelect id="param-value" name="value" defaultValue={String(p.value ?? "")} className="h-8 w-full">
          {p.options?.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </NativeSelect>
      );
    case "secret":
      return (
        <Input
          id="param-value"
          name="value"
          type="password"
          autoComplete="off"
          className="font-mono"
          placeholder={p.maskedValue ? T.secretKeep(p.maskedValue) : T.secretEmpty}
          autoFocus
        />
      );
    default:
      return (
        <Input
          id="param-value"
          name="value"
          type={p.type === "number" ? "number" : p.type === "email" ? "email" : p.type === "url" ? "url" : "text"}
          defaultValue={p.value === null ? "" : String(p.value)}
          min={p.min}
          max={p.max}
          className={p.monospace ? "font-mono" : undefined}
          autoFocus
        />
      );
  }
}

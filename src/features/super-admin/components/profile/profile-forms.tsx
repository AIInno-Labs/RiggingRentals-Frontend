"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldRow, FormError } from "@/features/super-admin/components/common/form-parts";
import { Panel, PanelHeader } from "@/features/super-admin/components/common/layout-parts";
import { changePasswordAction, updateProfileAction } from "@/features/super-admin/actions/profile";
import { COPY } from "@/features/super-admin/constants/copy";
import type { SuperAdminProfile } from "@/features/super-admin/types";

const get = (fd: FormData, key: string) => String(fd.get(key) ?? "");

function FormFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2 border-t border-zinc-200 bg-muted/50 px-4 py-3">{children}</div>;
}

export function ProfileDetailsForm({ profile }: { profile: SuperAdminProfile }) {
  const T = COPY.profile.details;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Panel>
      <PanelHeader title={T.title} />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const result = await updateProfileAction({ name: get(fd, "name"), mobile: get(fd, "mobile") });
            if (result.success) toast.success(T.saved);
            else setError(result.error.message);
          });
        }}
      >
        <div className="p-4">
          <FormError message={error} />
          <FieldRow>
            <Field label={T.name} htmlFor="profile-name" required>
              <Input id="profile-name" name="name" defaultValue={profile.name} />
            </Field>
            <Field label={T.mobile} htmlFor="profile-mobile">
              <Input id="profile-mobile" name="mobile" defaultValue={profile.mobile} placeholder={T.mobilePlaceholder} />
            </Field>
          </FieldRow>
          <Field label={T.email} htmlFor="profile-email">
            <Input id="profile-email" value={profile.email} disabled readOnly />
          </Field>
        </div>
        <FormFooter>
          <Button type="submit" disabled={pending}>
            {T.submit}
          </Button>
        </FormFooter>
      </form>
    </Panel>
  );
}

export function ChangePasswordForm() {
  const T = COPY.profile.password;
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Panel>
      <PanelHeader title={T.title} />
      <form
        ref={formRef}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const result = await changePasswordAction({
              currentPassword: get(fd, "currentPassword"),
              newPassword: get(fd, "newPassword"),
              confirmPassword: get(fd, "confirmPassword"),
            });
            if (!result.success) return setError(result.error.message);
            formRef.current?.reset();
            toast.success(T.saved);
          });
        }}
      >
        <div className="p-4">
          <FormError message={error} />
          <Field label={T.current} htmlFor="pw-current">
            <Input id="pw-current" name="currentPassword" type="password" autoComplete="current-password" />
          </Field>
          <FieldRow>
            <Field
              label={
                <>
                  {T.new} <span className="font-normal text-muted-foreground">{T.newMin}</span>
                </>
              }
              htmlFor="pw-new"
            >
              <Input id="pw-new" name="newPassword" type="password" autoComplete="new-password" />
            </Field>
            <Field label={T.confirm} htmlFor="pw-confirm">
              <Input id="pw-confirm" name="confirmPassword" type="password" autoComplete="new-password" />
            </Field>
          </FieldRow>
        </div>
        <FormFooter>
          <Button type="submit" disabled={pending} className="bg-zinc-900 text-brand hover:bg-black">
            {T.submit}
          </Button>
        </FormFooter>
      </form>
    </Panel>
  );
}

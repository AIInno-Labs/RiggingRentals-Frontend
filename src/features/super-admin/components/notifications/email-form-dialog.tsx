"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckTile, Field, Segmented } from "@/features/super-admin/components/common/form-parts";
import { Note, SectionTitle } from "@/features/super-admin/components/common/layout-parts";
import { FormDialog } from "@/features/super-admin/components/common/overlays";
import { EmailPreview } from "@/features/super-admin/components/notifications/email-preview";
import { resetEmailTemplateAction, sendTestEmailAction, updateEmailTemplateAction } from "@/features/super-admin/actions/notifications";
import { COPY } from "@/features/super-admin/constants/copy";
import { EMAIL_RECIPIENT_LABELS, EMAIL_TEMPLATE_VARIABLES } from "@/features/super-admin/constants/domain";
import type { EmailPreviewContext, EmailRecipient, EmailSendMode, EmailTemplate, OrganizationOption } from "@/features/super-admin/types";

const T = COPY.notifications.form;

export const whenText = (t: EmailTemplate) => (t.timing ? COPY.notifications.when(t.timing.days, t.timing.label) : t.trigger);

/** Edit an email at platform or organization scope. Render with a `key` per email. */
export function EmailFormDialog({
  template: t,
  organization,
  previewContext,
  open,
  onOpenChange,
}: {
  template: EmailTemplate;
  organization?: OrganizationOption;
  previewContext: EmailPreviewContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [subject, setSubject] = useState(t.subject);
  const [body, setBody] = useState(t.body);
  const [recipients, setRecipients] = useState<EmailRecipient[]>(t.recipients);
  const [mode, setMode] = useState<EmailSendMode>(t.mode);
  const [adminCanTurnOff, setAdminCanTurnOff] = useState(t.adminCanTurnOff);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");
  const orgName = organization?.name ?? null;

  /** Inserts {field} where the cursor was in the subject or body. */
  function insertVariable(variable: string) {
    const token = `{${variable}}`;
    const isSubject = lastFocused.current === "subject";
    const el = isSubject ? subjectRef.current : bodyRef.current;
    const current = isSubject ? subject : body;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? start;
    const next = current.slice(0, start) + token + current.slice(end);
    (isSubject ? setSubject : setBody)(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function save(fd: FormData) {
    setError(null);
    const days = t.timing ? Number(fd.get("days")) : undefined;
    startTransition(async () => {
      const result = await updateEmailTemplateAction(
        t.id,
        {
          subject,
          body,
          recipients,
          days,
          mode: t.modeSelectable ? mode : undefined,
          adminCanTurnOff: organization ? undefined : adminCanTurnOff,
        },
        organization?.id,
      );
      if (!result.success) return setError(result.error.message);
      toast.success(COPY.notifications.toast.saved(t.name, orgName));
      onOpenChange(false);
    });
  }

  function sendTest() {
    startTransition(async () => {
      const result = await sendTestEmailAction(t.id, organization?.id);
      if (result.success) toast.success(COPY.notifications.toast.testSent(result.data.sentTo));
      else toast.error(result.error.message);
    });
  }

  function usePlatformVersion() {
    if (!organization) return;
    startTransition(async () => {
      const result = await resetEmailTemplateAction(t.id, organization.id);
      if (!result.success) return setError(result.error.message);
      toast.success(COPY.notifications.toast.reset(t.name, organization.name));
      onOpenChange(false);
    });
  }

  const toggleRecipient = (r: EmailRecipient, on: boolean) =>
    setRecipients((list) => (on ? [...list, r] : list.filter((x) => x !== r)));

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={T.title(t.name)}
      subtitle={T.subtitle(whenText(t), orgName)}
      error={error}
      pending={pending}
      submitLabel={T.submit}
      onSubmit={save}
      footerStart={
        <>
          <Button type="button" variant="outline" disabled={pending} onClick={sendTest}>
            {T.sendTest}
          </Button>
          {organization && t.custom ? (
            <Button type="button" variant="outline" disabled={pending} onClick={usePlatformVersion}>
              {T.usePlatform}
            </Button>
          ) : null}
        </>
      }
    >
      {organization ? (
        <Note tone={t.custom ? "brand" : "muted"} className="mb-3">
          {t.custom ? T.customNote(organization.name) : T.inheritNote(organization.name)}
        </Note>
      ) : null}

      <SectionTitle>{T.sendingSection}</SectionTitle>
      <p className="-mt-1 mb-3 text-[12.5px] text-muted-foreground">
        {t.trigger}
        {t.attachment ? (
          <>
            {" · "}
            <b>{T.attachedAutomatically(t.attachment)}</b>
          </>
        ) : null}
      </p>

      {t.modeSelectable ? (
        <Field label={T.howSent}>
          <Segmented<EmailSendMode>
            ariaLabel={T.howSent}
            value={mode}
            onChange={setMode}
            options={[
              { value: "auto", label: T.modeAuto },
              { value: "manual", label: T.modeManual },
            ]}
          />
        </Field>
      ) : null}

      {t.timing ? (
        <Field label={T.send} htmlFor="email-days">
          <div className="flex flex-wrap items-center gap-2">
            <Input id="email-days" name="days" type="number" min={1} max={90} defaultValue={t.timing.days} className="w-20" />
            <span>{T.days(t.timing.label)}</span>
          </div>
        </Field>
      ) : null}

      <Field label={T.sendTo} required>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-1.5">
          {t.allowedRecipients.map((r) => (
            <CheckTile
              key={r}
              name="recipients"
              value={r}
              checked={recipients.includes(r)}
              onChange={(on) => toggleRecipient(r, on)}
              title={<span className="font-normal">{EMAIL_RECIPIENT_LABELS[r]}</span>}
            />
          ))}
        </div>
      </Field>

      {organization ? null : (
        <div className="mb-1.5">
          <CheckTile
            name="adminCanTurnOff"
            value="on"
            checked={adminCanTurnOff}
            onChange={setAdminCanTurnOff}
            title={T.adminCanTurnOff}
            description={T.adminCanTurnOffHint}
          />
        </div>
      )}

      <SectionTitle>{T.messageSection}</SectionTitle>
      <Field label={T.subject} htmlFor="email-subject" required>
        <Input
          id="email-subject"
          ref={subjectRef}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onFocus={() => (lastFocused.current = "subject")}
        />
      </Field>
      <Field label={T.body} htmlFor="email-body" required hint={T.bodyHint}>
        <Textarea
          id="email-body"
          ref={bodyRef}
          rows={9}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => (lastFocused.current = "body")}
        />
        <div className="flex flex-wrap">
          {EMAIL_TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVariable(v)}
              className="my-0.5 mr-1 inline-flex h-5 items-center rounded-full border border-border bg-white px-2 font-mono text-[11px] hover:border-brand hover:bg-brand/[0.12]"
            >
              {`{${v}}`}
            </button>
          ))}
        </div>
      </Field>

      <SectionTitle>{T.previewSection}</SectionTitle>
      <EmailPreview subject={subject} body={body} attachment={t.attachment} context={previewContext} isPlatform={!organization} />
    </FormDialog>
  );
}

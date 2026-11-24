import { BrandLogo } from "@/components/brand-logo";
import { COMPANY } from "@/features/documents/company-profile";
import { COPY } from "@/features/super-admin/constants/copy";
import { fillTemplate, previewValues, toParagraphs } from "@/features/super-admin/lib/email-preview";
import type { EmailPreviewContext } from "@/features/super-admin/types";

const T = COPY.notifications.preview;

/** Renders an email the way customers see it (mirrors lib/email/send.ts emailShell). */
export function EmailPreview({
  subject,
  body,
  attachment,
  context,
  isPlatform,
}: {
  subject: string;
  body: string;
  attachment: string;
  context: EmailPreviewContext;
  isPlatform: boolean;
}) {
  const values = previewValues(context);
  const filledSubject = fillTemplate(subject, values);
  const org = context.organization;

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
        <div className="border-b border-zinc-200 bg-white px-3 py-2 text-[12.5px] text-muted-foreground">
          {T.from} {context.fromName} &lt;{context.fromAddress}&gt;
          {context.replyTo ? ` · ${T.replyTo} ${context.replyTo}` : null}
          <br />
          {T.subject} <b className="text-foreground">{filledSubject}</b>
        </div>
        <div className="m-3 rounded-md bg-white p-4 font-[Arial,sans-serif] text-[13.5px] leading-normal text-[#1a1f24]">
          <div className="mb-3.5 border-b-[3px] border-[#1a1a1a] pb-3">
            <BrandLogo variant="email" />
            <h4 className="mt-2 font-[Arial,sans-serif] text-lg font-bold tracking-normal">{filledSubject}</h4>
          </div>
          {toParagraphs(fillTemplate(body, values)).map((lines, i) => (
            <p key={i} className="mb-2.5">
              {lines.map((line, j) => (
                <span key={j}>
                  {j > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </p>
          ))}
          {attachment ? (
            <span className="inline-block rounded-md border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-[12.5px]">{T.attachment(attachment)}</span>
          ) : null}
          <div className="mt-5 text-[11.5px] text-[#5c6570]">
            {COMPANY.legalName} · ABN {COMPANY.abn}
            <br />
            {org.address}
            <br />
            {[org.phone || COMPANY.phone, org.email || COMPANY.email].join(" · ")}
            <br />
            {COMPANY.website.replace(/^https?:\/\//, "")}
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[12.5px] text-muted-foreground">{T.note(isPlatform ? org.name : null)}</p>
    </div>
  );
}

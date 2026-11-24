import { COMPANY } from "@/features/documents/company-profile";
import { EMAIL_PREVIEW_SAMPLE } from "@/features/super-admin/constants/domain";
import type { EmailPreviewContext } from "@/features/super-admin/types";

/** Values used to fill {placeholders} in the email preview. */
export function previewValues(ctx: EmailPreviewContext): Record<string, string> {
  const { organization: org } = ctx;
  const { orderSuffix, invoiceSuffix, ...sample } = EMAIL_PREVIEW_SAMPLE;
  return {
    ...sample,
    company_name: COMPANY.tradingAs,
    order_number: `${org.code}-${orderSuffix}`,
    invoice_number: `${org.code}-${invoiceSuffix}`,
    org_name: org.name,
    org_phone: org.phone || COMPANY.phone,
    accounts_email: COMPANY.accountsEmail,
    bsb: COMPANY.bank.bsb,
    account: COMPANY.bank.account,
  };
}

/** Replaces {name} placeholders; unknown ones are left as typed. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/** Splits an email body into paragraphs (blank line) and lines. */
export function toParagraphs(body: string): string[][] {
  return body.split(/\n{2,}/).map((p) => p.split("\n"));
}

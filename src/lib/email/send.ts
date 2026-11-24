import { Resend } from "resend";
import {
  COMPANY,
  companyLogoAbsoluteUrl,
} from "@/features/documents/company-profile";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult =
  | { ok: true; provider: "resend" | "mailto"; id: string; mailto: string }
  | { ok: false; error: string; mailto: string };

function buildMailto(to: string, subject: string, text: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

/** Prefer Resend when RESEND_API_KEY is set; always return mailto fallback. */
export async function sendAppEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const text = input.text ?? input.html.replace(/<[^>]+>/g, " ");
  const mailto = buildMailto(input.to, input.subject, text);
  const key = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    `${COMPANY.tradingAs} <onboarding@resend.dev>`;

  if (!key || !input.to) {
    return {
      ok: false,
      error: key
        ? "Recipient email missing"
        : "RESEND_API_KEY not set — use mailto fallback",
      mailto,
    };
  }

  try {
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text,
    });
    if (error) {
      return { ok: false, error: error.message, mailto };
    }
    return {
      ok: true,
      provider: "resend",
      id: data?.id ?? "sent",
      mailto,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Email send failed",
      mailto,
    };
  }
}

export function emailShell(title: string, bodyHtml: string): string {
  const logoUrl = companyLogoAbsoluteUrl();
  const brandBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${COMPANY.tradingAs}" width="220" height="50" style="display:block;height:50px;width:auto;margin-bottom:8px" />`
    : `<p style="margin:0;background:#f5d400;color:#111;display:inline-block;padding:6px 10px;font-weight:700;letter-spacing:0.02em">${COMPANY.tradingAs}</p>`;

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1a1f24;line-height:1.5">
  <div style="border-bottom:3px solid #1a1a1a;padding-bottom:12px;margin-bottom:16px">
    ${brandBlock}
    <h1 style="margin:8px 0 0;font-size:20px">${title}</h1>
  </div>
  ${bodyHtml}
  <p style="margin-top:24px;font-size:12px;color:#5c6570">
    ${COMPANY.legalName} · ABN ${COMPANY.abn}<br/>
    ${COMPANY.addressLine1}, ${COMPANY.addressLine2}<br/>
    ${COMPANY.phone} · ${COMPANY.email}<br/>
    <a href="${COMPANY.website}" style="color:#1a1a1a">${COMPANY.website.replace(/^https?:\/\//, "")}</a>
  </p>
  </body></html>`;
}

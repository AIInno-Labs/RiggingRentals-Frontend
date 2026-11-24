"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { COMPANY, formatAud, formatAuDate } from "@/features/documents/company-profile";
import { hireTermsHtmlList, HIRE_CLAUSES } from "@/features/documents/hire-terms";
import { emailShell, sendAppEmail } from "@/lib/email/send";

async function logComm(params: {
  order_id?: string;
  invoice_id?: string;
  kind: "quote" | "order_confirm" | "tnc" | "invoice" | "other";
  to_email: string;
  subject: string;
  body: string;
  provider: string;
  provider_message_id: string;
  status: string;
}) {
  const db = await rentalDb();
  const { data: userData } = await db.auth.getUser();
  await db.from("communications").insert({
    ...params,
    channel: params.provider,
    created_by: userData.user?.id ?? null,
  });
}

export async function sendOrderConfirmEmailAction(
  orderId: string,
): Promise<ActionResult<{ sent: boolean; mailto: string }>> {
  const idParsed = z.string().guid().safeParse(orderId);
  if (!idParsed.success) return fail("VALIDATION_ERROR", "Invalid order");
  const db = await rentalDb();
  const { data: order } = await db
    .from("orders")
    .select(
      "order_number, start_at, end_at, jobsite_name, purchase_order, clients(company_name, contact_name, email)",
    )
    .eq("id", orderId)
    .single();
  if (!order) return fail("DB_ERROR", "Order missing");
  const o = order as {
    order_number: string;
    start_at: string;
    end_at: string;
    jobsite_name: string;
    purchase_order: string;
    clients:
      | { company_name: string; contact_name: string; email: string }
      | { company_name: string; contact_name: string; email: string }[]
      | null;
  };
  const client = Array.isArray(o.clients) ? o.clients[0] : o.clients;
  const to = client?.email ?? "";
  const subject = `${COMPANY.tradingAs} — Order confirmation ${o.order_number}`;
  const text = [
    `Hi ${client?.contact_name || client?.company_name || "there"},`,
    "",
    `Your hire is confirmed: ${o.order_number}.`,
    `Jobsite: ${o.jobsite_name || "—"}`,
    `PO / Cust job: ${o.purchase_order || "—"}`,
    `Hire window: ${formatAuDate(o.start_at)} → ${formatAuDate(o.end_at)}`,
    "",
    "Conditions of Hire apply. Invoices issue at calendar month-end (clause 3(e)).",
    "",
    COMPANY.legalName,
  ].join("\n");
  const html = emailShell(
    `Order confirmation ${o.order_number}`,
    `<p>Hi ${client?.contact_name || client?.company_name || "there"},</p>
     <p>Your hire <strong>${o.order_number}</strong> is confirmed.</p>
     <ul>
       <li>Jobsite: ${o.jobsite_name || "—"}</li>
       <li>PO / Cust job: ${o.purchase_order || "—"}</li>
       <li>Hire: ${formatAuDate(o.start_at)} → ${formatAuDate(o.end_at)}</li>
     </ul>
     <p>Conditions of Hire (TnC) apply. Invoices are issued at the end of each calendar month for hire in that month.</p>`,
  );

  const sent = await sendAppEmail({ to, subject, html, text });
  await logComm({
    order_id: orderId,
    kind: "order_confirm",
    to_email: to,
    subject,
    body: text,
    provider: sent.ok ? sent.provider : "mailto",
    provider_message_id: sent.ok ? sent.id : "",
    status: sent.ok ? "sent" : "mailto_fallback",
  });
  await db
    .from("orders")
    .update({ confirm_email_logged_at: new Date().toISOString() })
    .eq("id", orderId);
  revalidatePath(`/admin/orders/${orderId}`);
  return ok({ sent: sent.ok, mailto: sent.mailto });
}

export async function sendQuoteEmailAction(
  orderId: string,
): Promise<ActionResult<{ sent: boolean; mailto: string }>> {
  const idParsed = z.string().guid().safeParse(orderId);
  if (!idParsed.success) return fail("VALIDATION_ERROR", "Invalid order");
  const db = await rentalDb();
  const { data: order } = await db
    .from("orders")
    .select(
      "order_number, start_at, end_at, quote_valid_until, clients(company_name, contact_name, email)",
    )
    .eq("id", orderId)
    .single();
  if (!order) return fail("DB_ERROR", "Order missing");
  const { data: items } = await db
    .from("order_items")
    .select("quantity, daily_rate, equipment_catalog(sku, name)")
    .eq("order_id", orderId);

  const o = order as {
    order_number: string;
    start_at: string;
    end_at: string;
    quote_valid_until: string | null;
    clients:
      | { company_name: string; contact_name: string; email: string }
      | { company_name: string; contact_name: string; email: string }[]
      | null;
  };
  const client = Array.isArray(o.clients) ? o.clients[0] : o.clients;
  const to = client?.email ?? "";
  const lines = (items ?? [])
    .map((raw) => {
      const it = raw as {
        quantity: number;
        daily_rate: number;
        equipment_catalog:
          | { sku: string; name: string }
          | { sku: string; name: string }[]
          | null;
      };
      const cat = Array.isArray(it.equipment_catalog)
        ? it.equipment_catalog[0]
        : it.equipment_catalog;
      return `<li>${it.quantity}× ${cat?.sku ?? ""} ${cat?.name ?? ""} @ ${formatAud(asNumber(it.daily_rate))}/day</li>`;
    })
    .join("");

  const subject = `${COMPANY.tradingAs} Quotation ${o.order_number}`;
  const notesBlock = COMPANY.defaultQuoteNotes.map((n) => `• ${n}`).join("\n");
  const termsText = HIRE_CLAUSES.map((c, i) => `${i + 1}. ${c}`).join("\n");
  const appBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "").trim();
  const hireLink = appBase
    ? `${appBase}/admin/orders/${orderId}/documents/hire-agreement`
    : "";
  const text = `Quotation ${o.order_number} for ${client?.company_name}.
Valid until ${formatAuDate(o.quote_valid_until)}.
Hire ${formatAuDate(o.start_at)} → ${formatAuDate(o.end_at)}.

Line items include daily rates as listed in the email HTML.

Notes:
${notesBlock}

Conditions of Hire (summary) — RigRent QED.10:
${termsText}
${hireLink ? `\nFull hire agreement: ${hireLink}` : ""}`;
  const html = emailShell(
    `Quotation ${o.order_number}`,
    `<p>Hi ${client?.contact_name || client?.company_name || "there"},</p>
     <p>Please find our quotation for hire <strong>${formatAuDate(o.start_at)} → ${formatAuDate(o.end_at)}</strong>.</p>
     <ul>${lines}</ul>
     <p><strong>Valid until ${formatAuDate(o.quote_valid_until)}.</strong> All prices subject to +10% GST. Subject to availability.</p>
     <p><strong>Notes</strong></p>
     <ul>${COMPANY.defaultQuoteNotes.map((n) => `<li>${n}</li>`).join("")}</ul>
     <p><strong>Conditions of Hire (summary) — RigRent QED.10</strong></p>
     <ol>${hireTermsHtmlList()}</ol>
     ${hireLink ? `<p><a href="${hireLink}">View full hire agreement</a></p>` : "<p>Full Conditions of Hire (RigRent QED.10) apply and are issued with confirmation.</p>"}`,
  );
  const sent = await sendAppEmail({ to, subject, html, text });
  await logComm({
    order_id: orderId,
    kind: "quote",
    to_email: to,
    subject,
    body: text,
    provider: sent.ok ? sent.provider : "mailto",
    provider_message_id: sent.ok ? sent.id : "",
    status: sent.ok ? "sent" : "mailto_fallback",
  });
  revalidatePath(`/admin/orders/${orderId}`);
  return ok({ sent: sent.ok, mailto: sent.mailto });
}

export async function sendInvoiceEmailAction(
  invoiceId: string,
): Promise<ActionResult<{ sent: boolean; mailto: string }>> {
  const idParsed = z.string().guid().safeParse(invoiceId);
  if (!idParsed.success) return fail("VALIDATION_ERROR", "Invalid invoice");
  const db = await rentalDb();
  const { data: inv } = await db
    .from("invoices")
    .select(
      "id, invoice_number, total, period_start, period_end, gst_amount, orders(order_number, clients(company_name, email, contact_name))",
    )
    .eq("id", invoiceId)
    .single();
  if (!inv) return fail("DB_ERROR", "Invoice missing");
  const row = inv as unknown as {
    id: string;
    invoice_number: string;
    total: number;
    period_start: string | null;
    period_end: string | null;
    gst_amount: number;
    orders: {
      order_number: string;
      clients:
        | { company_name: string; email: string; contact_name: string }
        | { company_name: string; email: string; contact_name: string }[]
        | null;
    } | null;
  };
  const order = row.orders;
  const client = order
    ? Array.isArray(order.clients)
      ? order.clients[0]
      : order.clients
    : null;
  const to = client?.email ?? "";
  const subject = `${COMPANY.tradingAs} Tax Invoice ${row.invoice_number}`;
  const text = [
    `Tax Invoice ${row.invoice_number}`,
    `Contract ${order?.order_number}`,
    `Period ${row.period_start} → ${row.period_end}`,
    `Total ${formatAud(asNumber(row.total))} (incl GST ${formatAud(asNumber(row.gst_amount))})`,
    `Remit BSB ${COMPANY.bank.bsb} A/C ${COMPANY.bank.account}`,
  ].join("\n");
  const html = emailShell(
    `Tax Invoice ${row.invoice_number}`,
    `<p>Hi ${client?.contact_name || client?.company_name || "Accounts"},</p>
     <p>Tax Invoice <strong>${row.invoice_number}</strong> for contract ${order?.order_number}.</p>
     <p>Period: ${formatAuDate(row.period_start)} – ${formatAuDate(row.period_end)}<br/>
     Total due: <strong>${formatAud(asNumber(row.total))}</strong> (incl GST)</p>
     <p>Remit to ${COMPANY.accountsEmail}<br/>BSB ${COMPANY.bank.bsb} · A/C ${COMPANY.bank.account}</p>`,
  );
  const sent = await sendAppEmail({ to, subject, html, text });
  await logComm({
    invoice_id: row.id,
    kind: "invoice",
    to_email: to,
    subject,
    body: text,
    provider: sent.ok ? sent.provider : "mailto",
    provider_message_id: sent.ok ? sent.id : "",
    status: sent.ok ? "sent" : "mailto_fallback",
  });
  await db
    .from("invoices")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", row.id);
  revalidatePath("/billing");
  return ok({ sent: sent.ok, mailto: sent.mailto });
}

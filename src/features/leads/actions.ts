"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { rentalDb } from "@/lib/supabase/rental-db";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { COMPANY } from "@/features/documents/company-profile";
import {
  sanitizeCompanyName,
  sanitizeContactName,
} from "@/features/leads/parse-email-lead";

const leadSchema = z.object({
  source: z.enum(["phone", "email", "walk_in", "other"]).default("phone"),
  company_name: z.string().min(1),
  contact_name: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  notes: z.string().default(""),
  estimate_notes: z.string().default(""),
  estimated_value: z.number().nonnegative().default(0),
  status: z.enum(["new", "qualified", "quoted", "won", "lost"]).default("new"),
});

export async function createLeadAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const company_name = sanitizeCompanyName(parsed.data.company_name);
  if (!company_name) {
    return fail(
      "VALIDATION_ERROR",
      "Company looks like an email greeting — enter the client company name.",
    );
  }
  const db = await rentalDb();
  const { data: userData } = await db.auth.getUser();
  const { data, error } = await db
    .from("leads")
    .insert({
      ...parsed.data,
      company_name,
      contact_name: sanitizeContactName(parsed.data.contact_name),
      status: parsed.data.status === "new" ? "qualified" : parsed.data.status,
      created_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return fail("DB_ERROR", error?.message ?? "Insert failed");
  revalidatePath("/admin/leads");
  return ok({ id: (data as { id: string }).id });
}

export async function updateLeadStatusAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const schema = z.object({
    id: z.string().guid(),
    status: z.enum(["new", "qualified", "quoted", "won", "lost"]),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { error } = await db
    .from("leads")
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return fail("DB_ERROR", error.message);
  revalidatePath("/admin/leads");
  return ok({ id: parsed.data.id });
}

export async function convertLeadToClientAction(
  leadId: string,
): Promise<ActionResult<{ client_id: string }>> {
  const idParsed = z.string().guid().safeParse(leadId);
  if (!idParsed.success) return fail("VALIDATION_ERROR", "Invalid lead");
  const db = await rentalDb();
  const { data: lead } = await db
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (!lead) return fail("DB_ERROR", "Lead missing");
  const l = lead as {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    phone: string;
    notes: string;
    client_id: string | null;
  };
  if (l.client_id) return ok({ client_id: l.client_id });

  const companyName = sanitizeCompanyName(l.company_name);
  const contactName = sanitizeContactName(l.contact_name);
  if (!companyName) {
    return fail(
      "VALIDATION_ERROR",
      "Lead company looks like an email greeting — edit the company name first.",
    );
  }

  // Reuse an existing client with the same company name when possible
  const { data: existing } = await db
    .from("clients")
    .select("id")
    .ilike("company_name", companyName)
    .limit(1)
    .maybeSingle();
  if (existing) {
    const clientId = (existing as { id: string }).id;
    await db
      .from("leads")
      .update({
        client_id: clientId,
        status: "qualified",
        updated_at: new Date().toISOString(),
      })
      .eq("id", l.id);
    revalidatePath("/admin/leads");
    revalidatePath("/admin/clients");
    revalidatePath("/admin/pipeline");
    return ok({ client_id: clientId });
  }

  const { data: client, error } = await db
    .from("clients")
    .insert({
      company_name: companyName,
      contact_name: contactName,
      email: l.email,
      phone: l.phone,
      notes: `From lead. ${l.notes}`,
    })
    .select("id")
    .single();
  if (error || !client) return fail("DB_ERROR", error?.message ?? "Client failed");
  await db
    .from("leads")
    .update({
      client_id: (client as { id: string }).id,
      status: "qualified",
      updated_at: new Date().toISOString(),
    })
    .eq("id", l.id);
  revalidatePath("/admin/leads");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/pipeline");
  return ok({ client_id: (client as { id: string }).id });
}

const commSchema = z.object({
  order_id: z.string().guid().optional(),
  invoice_id: z.string().guid().optional(),
  lead_id: z.string().guid().optional(),
  kind: z.enum(["quote", "order_confirm", "tnc", "invoice", "other"]),
  to_email: z.string().default(""),
  subject: z.string().min(1),
  body: z.string().default(""),
  status: z.string().default("logged"),
});

export async function logCommunicationAction(
  input: unknown,
): Promise<ActionResult<{ id: string; mailto: string }>> {
  const parsed = commSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data: userData } = await db.auth.getUser();
  const { data, error } = await db
    .from("communications")
    .insert({
      ...parsed.data,
      channel: "mailto",
      created_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return fail("DB_ERROR", error?.message ?? "Log failed");

  if (parsed.data.kind === "order_confirm" && parsed.data.order_id) {
    await db
      .from("orders")
      .update({ confirm_email_logged_at: new Date().toISOString() })
      .eq("id", parsed.data.order_id);
  }
  if (parsed.data.kind === "invoice" && parsed.data.invoice_id) {
    await db
      .from("invoices")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", parsed.data.invoice_id);
  }

  const mailto = `mailto:${encodeURIComponent(parsed.data.to_email)}?subject=${encodeURIComponent(parsed.data.subject)}&body=${encodeURIComponent(parsed.data.body)}`;
  revalidatePath("/billing");
  revalidatePath("/admin/pipeline");
  revalidatePath(`/admin/orders/${parsed.data.order_id ?? ""}`);
  return ok({ id: (data as { id: string }).id, mailto });
}

export async function buildOrderConfirmMailtoAction(
  orderId: string,
): Promise<
  ActionResult<{ mailto: string; to_email: string; subject: string; body: string }>
> {
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
  const body = [
    `Hi ${client?.contact_name || client?.company_name || "there"},`,
    "",
    `Your hire is confirmed: ${o.order_number}.`,
    `Jobsite: ${o.jobsite_name || "—"}`,
    `PO / Cust job: ${o.purchase_order || "—"}`,
    `Hire window: ${new Date(o.start_at).toLocaleDateString("en-AU")} → ${new Date(o.end_at).toLocaleDateString("en-AU")}`,
    "",
    "Please find our Conditions of Hire (TnC) attached / linked from the portal.",
    `Key rule: invoices issue at calendar month-end for days on hire that month (clause 3(e)).`,
    "",
    `Questions: ${COMPANY.email} · ${COMPANY.phone}`,
    "",
    COMPANY.legalName,
  ].join("\n");

  const logged = await logCommunicationAction({
    order_id: orderId,
    kind: "order_confirm",
    to_email: to,
    subject,
    body,
    status: "ready_to_send",
  });
  if (!logged.success) return logged;

  return ok({
    mailto: logged.data.mailto,
    to_email: to,
    subject,
    body,
  });
}

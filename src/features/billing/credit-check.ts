import { asNumber, rentalDb } from "@/lib/supabase/rental-db";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

export type CreditCheckOk = {
  client_id: string;
  company_name: string;
  on_stop: boolean;
  overdue_total: number;
  open_ar_total: number;
  credit_limit: number;
};

/** Blocks confirm/dispatch when account is on stop, overdue, or over credit limit. */
export async function assertClientCanTransact(
  clientId: string,
): Promise<ActionResult<CreditCheckOk>> {
  const db = await rentalDb();
  const { data: client, error } = await db
    .from("clients")
    .select(
      "id, company_name, credit_account, credit_limit, on_stop, on_stop_reason, payment_terms_days",
    )
    .eq("id", clientId)
    .single();

  if (error || !client) {
    return fail("DB_ERROR", error?.message ?? "Client not found");
  }

  const c = client as {
    id: string;
    company_name: string;
    credit_account: boolean;
    credit_limit: number;
    on_stop: boolean;
    on_stop_reason: string;
    payment_terms_days: number;
  };

  if (c.on_stop) {
    return fail(
      "CREDIT_HOLD",
      `Account on stop${c.on_stop_reason ? `: ${c.on_stop_reason}` : ""}. Clear the hold on the client before confirming or dispatching.`,
    );
  }

  if (!c.credit_account) {
    return ok({
      client_id: c.id,
      company_name: c.company_name,
      on_stop: false,
      overdue_total: 0,
      open_ar_total: 0,
      credit_limit: 0,
    });
  }

  const { data: orders } = await db
    .from("orders")
    .select("id")
    .eq("client_id", clientId);
  const orderIds = (orders ?? []).map((o) => (o as { id: string }).id);
  if (orderIds.length === 0) {
    return ok({
      client_id: c.id,
      company_name: c.company_name,
      on_stop: false,
      overdue_total: 0,
      open_ar_total: 0,
      credit_limit: asNumber(c.credit_limit),
    });
  }

  const { data: invoices } = await db
    .from("invoices")
    .select("total, paid_amount, paid_at, payment_due_at, status")
    .in("order_id", orderIds)
    .eq("status", "approved");

  const today = new Date().toISOString().slice(0, 10);
  let openAr = 0;
  let overdue = 0;

  for (const row of invoices ?? []) {
    const inv = row as {
      total: number;
      paid_amount: number;
      paid_at: string | null;
      payment_due_at: string | null;
    };
    if (inv.paid_at) continue;
    const owing = Math.max(0, asNumber(inv.total) - asNumber(inv.paid_amount));
    if (owing <= 0) continue;
    openAr += owing;
    if (inv.payment_due_at && inv.payment_due_at < today) {
      overdue += owing;
    }
  }

  if (overdue > 0) {
    return fail(
      "CREDIT_HOLD",
      `${c.company_name} has overdue invoices ($${overdue.toFixed(0)}). Collect payment or mark paid before hiring more gear.`,
    );
  }

  const limit = asNumber(c.credit_limit);
  if (limit > 0 && openAr >= limit) {
    return fail(
      "CREDIT_HOLD",
      `${c.company_name} is at credit limit ($${openAr.toFixed(0)} / $${limit.toFixed(0)} unpaid).`,
    );
  }

  return ok({
    client_id: c.id,
    company_name: c.company_name,
    on_stop: false,
    overdue_total: overdue,
    open_ar_total: openAr,
    credit_limit: limit,
  });
}

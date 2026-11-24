"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  calculateTieredRate,
  inclusiveCalendarDays,
  lastDayOfMonth,
  toDateOnly,
} from "@/features/pricing/calculate-rate";
import { COMPANY } from "@/features/documents/company-profile";
import { formatSpecDisplay } from "@/features/catalog/dimensions-spec";
import { asNumber, rentalDb } from "@/lib/supabase/rental-db";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  effectiveHireStartDate,
  hasBillableQcFees,
  type QcFeeFields,
} from "@/features/billing/billing-period";

const compilePeriodSchema = z.object({
  order_id: z.string().guid(),
  period_start: z.string().min(8),
  period_end: z.string().min(8),
  kind: z.enum(["interim", "final", "credit"]).default("interim"),
  /** Final with QC/extras only — no hire-day rental lines (already billed). */
  fees_only: z.boolean().optional().default(false),
});

const discountSchema = z.object({
  invoice_id: z.string().guid(),
  discount_amount: z.number().nonnegative(),
  notes: z.string().default(""),
});

const approveSchema = z.object({ invoice_id: z.string().guid() });

const monthEndSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

type LineDraft = {
  kind:
    | "rental"
    | "meter_overage"
    | "fuel"
    | "damage"
    | "deposit_credit"
    | "discount"
    | "other";
  description: string;
  quantity: number;
  unit_amount: number;
  line_total: number;
  sort_order: number;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function paymentDueFromPeriodEnd(periodEnd: string): string {
  const d = new Date(`${periodEnd.slice(0, 10)}T00:00:00Z`);
  const due = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  // 30 days from end of month → last day of next month roughly; use EOM+30
  due.setUTCDate(due.getUTCDate() + 30);
  return due.toISOString().slice(0, 10);
}

async function nextUnbilledStart(
  db: Awaited<ReturnType<typeof rentalDb>>,
  orderId: string,
  hireStart: string,
): Promise<string> {
  const { data } = await db
    .from("invoices")
    .select("period_end")
    .eq("order_id", orderId)
    .neq("status", "void")
    .not("period_end", "is", null)
    .order("period_end", { ascending: false })
    .limit(1);
  const last = (data?.[0] as { period_end: string } | undefined)?.period_end;
  if (!last) return toDateOnly(hireStart);
  const next = new Date(`${last}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

async function effectiveHireStartForOrder(
  db: Awaited<ReturnType<typeof rentalDb>>,
  orderId: string,
  orderStartAt: string,
): Promise<string> {
  const { data: items } = await db
    .from("order_items")
    .select("id")
    .eq("order_id", orderId);
  const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
  if (itemIds.length === 0) return toDateOnly(orderStartAt);
  const { data: asgs } = await db
    .from("order_asset_assignments")
    .select("dispatched_at")
    .in("order_item_id", itemIds)
    .not("dispatched_at", "is", null);
  const dispatched = (asgs ?? []).map(
    (a) => (a as { dispatched_at: string }).dispatched_at,
  );
  return effectiveHireStartDate(orderStartAt, dispatched);
}

async function allocateInvoiceNumber(
  db: Awaited<ReturnType<typeof rentalDb>>,
): Promise<string> {
  const { data: invNo } = await db.rpc("next_invoice_number");
  if (typeof invNo === "string" && invNo.length > 0) return invNo;

  // Fallback if RPC missing: max numeric suffix + 1
  const { data: rows } = await db.from("invoices").select("invoice_number");
  let max = 0;
  for (const raw of rows ?? []) {
    const digits = String(
      (raw as { invoice_number: string }).invoice_number ?? "",
    ).replace(/\D/g, "");
    const n = Number.parseInt(digits, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `INV-${String(max + 1).padStart(6, "0")}`;
}

export async function compilePeriodInvoiceAction(
  input: unknown,
): Promise<ActionResult<{ invoice_id: string }>> {
  const parsed = compilePeriodSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }

  const periodStart = parsed.data.period_start.slice(0, 10);
  const periodEnd = parsed.data.period_end.slice(0, 10);
  const feesOnly = !!parsed.data.fees_only && parsed.data.kind === "final";
  const days = feesOnly
    ? 0
    : inclusiveCalendarDays(periodStart, periodEnd);
  if (!feesOnly && days <= 0) {
    return fail("VALIDATION_ERROR", "Invalid billing period");
  }

  const db = await rentalDb();
  const { data: order, error: oErr } = await db
    .from("orders")
    .select("*")
    .eq("id", parsed.data.order_id)
    .single();
  if (oErr || !order) return fail("DB_ERROR", oErr?.message ?? "Order missing");

  const o = order as {
    id: string;
    start_at: string;
    end_at: string;
    off_rent_at: string | null;
    fuel_surcharge: number;
    security_deposit: number;
    status: string;
  };

  const { data: items } = await db
    .from("order_items")
    .select("*, equipment_catalog(name, sku, dimensions)")
    .eq("order_id", o.id);

  const { data: assignments } = await db
    .from("order_asset_assignments")
    .select(
      "*, equipment_assets(serial_number), order_items!inner(order_id)",
    )
    .eq("order_items.order_id", o.id);

  const lines: LineDraft[] = [];
  let sort = 0;

  if (!feesOnly) {
    for (const item of items ?? []) {
      const it = item as {
        quantity: number;
        daily_rate: number;
        weekly_rate: number;
        monthly_rate: number;
        equipment_catalog:
          | { name: string; sku: string; dimensions?: string | null }
          | { name: string; sku: string; dimensions?: string | null }[]
          | null;
      };
      const cat = Array.isArray(it.equipment_catalog)
        ? it.equipment_catalog[0]
        : it.equipment_catalog;
      const rate = calculateTieredRate({
        days,
        dailyRate: asNumber(it.daily_rate),
        weeklyRate: asNumber(it.weekly_rate),
        monthlyRate: asNumber(it.monthly_rate),
      });
      const lineTotal = round(rate.amount * it.quantity);
      const spec = formatSpecDisplay(cat?.dimensions);
      const dimPart = spec ? ` · ${spec}` : "";
      lines.push({
        kind: "rental",
        description: `${cat?.sku ?? ""} ${cat?.name ?? "Equipment"}${dimPart} — ${formatAu(periodStart)} to ${formatAu(periodEnd)} · M/W/D ${rate.mwd}`,
        quantity: it.quantity,
        unit_amount: rate.amount,
        line_total: lineTotal,
        sort_order: sort++,
      });
    }
  }

  // Extras only on final invoice
  if (parsed.data.kind === "final") {
    for (const a of assignments ?? []) {
    const asg = a as {
      meter_overage_fee: number;
      meter_overage_hours: number;
      damage_fee: number;
      damaged: boolean;
      dirty?: boolean;
      cleaning_fee?: number;
      equipment_assets:
        | { serial_number: string }
        | { serial_number: string }[]
        | null;
    };
      const asset = Array.isArray(asg.equipment_assets)
        ? asg.equipment_assets[0]
        : asg.equipment_assets;
      if (asNumber(asg.meter_overage_fee) > 0) {
        lines.push({
          kind: "meter_overage",
          description: `Meter overage ${asset?.serial_number ?? ""} (${asNumber(asg.meter_overage_hours)} hrs)`,
          quantity: 1,
          unit_amount: asNumber(asg.meter_overage_fee),
          line_total: asNumber(asg.meter_overage_fee),
          sort_order: sort++,
        });
      }
      if (asNumber(asg.damage_fee) > 0) {
        lines.push({
          kind: "damage",
          description: `Damage / recert RRP ${asset?.serial_number ?? ""}`,
          quantity: 1,
          unit_amount: asNumber(asg.damage_fee),
          line_total: asNumber(asg.damage_fee),
          sort_order: sort++,
        });
      }
      const cleaning = asNumber(
        (asg as { cleaning_fee?: number }).cleaning_fee ?? 0,
      );
      if (cleaning > 0) {
        lines.push({
          kind: "other",
          description: `Cleaning fee RRP ${asset?.serial_number ?? ""}`,
          quantity: 1,
          unit_amount: cleaning,
          line_total: cleaning,
          sort_order: sort++,
        });
      }
      const missingFee = asNumber(
        (asg as { missing_fee?: number }).missing_fee ?? 0,
      );
      if (missingFee > 0) {
        lines.push({
          kind: "other",
          description: `Missing / replacement RRP ${asset?.serial_number ?? ""}`,
          quantity: 1,
          unit_amount: missingFee,
          line_total: missingFee,
          sort_order: sort++,
        });
      }
    }

    if (asNumber(o.fuel_surcharge) > 0) {
      lines.push({
        kind: "fuel",
        description: "Fuel surcharge",
        quantity: 1,
        unit_amount: asNumber(o.fuel_surcharge),
        line_total: asNumber(o.fuel_surcharge),
        sort_order: sort++,
      });
    }

    const deposit = asNumber(o.security_deposit);
    if (deposit > 0) {
      lines.push({
        kind: "deposit_credit",
        description: "Security deposit applied",
        quantity: 1,
        unit_amount: -deposit,
        line_total: -deposit,
        sort_order: sort++,
      });
    }
  }

  const subtotal = round(lines.reduce((s, l) => s + l.line_total, 0));
  if (feesOnly && lines.length === 0) {
    return fail("STATE", "No hire days or fees to bill");
  }
  const gstRate = COMPANY.gstRate;
  const taxable = Math.max(
    0,
    lines
      .filter((l) => l.kind !== "deposit_credit" && l.kind !== "discount")
      .reduce((s, l) => s + l.line_total, 0),
  );
  const gstAmount = round(taxable * gstRate);
  const total = round(subtotal + gstAmount);
  const depositApplied =
    parsed.data.kind === "final" ? asNumber(o.security_deposit) : 0;

  let invoiceNumber = await allocateInvoiceNumber(db);

  // Reuse draft of same kind+period if present
  const { data: existing } = await db
    .from("invoices")
    .select("id")
    .eq("order_id", o.id)
    .eq("status", "draft")
    .eq("kind", parsed.data.kind)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  let invoiceId: string;
  if (existing) {
    invoiceId = (existing as { id: string }).id;
    await db.from("invoice_lines").delete().eq("invoice_id", invoiceId);
    await db
      .from("invoices")
      .update({
        subtotal,
        deposit_applied: depositApplied,
        discount_amount: 0,
        gst_rate: gstRate,
        gst_amount: gstAmount,
        total,
        period_start: periodStart,
        period_end: periodEnd,
        kind: parsed.data.kind,
        payment_due_at: paymentDueFromPeriodEnd(periodEnd),
      })
      .eq("id", invoiceId);
  } else {
    let inv: { id: string } | null = null;
    let invErr: { message: string } | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) {
        invoiceNumber = await allocateInvoiceNumber(db);
      }
      const inserted = await db
        .from("invoices")
        .insert({
          order_id: o.id,
          invoice_number: invoiceNumber,
          status: "draft",
          kind: parsed.data.kind,
          period_start: periodStart,
          period_end: periodEnd,
          subtotal,
          deposit_applied: depositApplied,
          discount_amount: 0,
          gst_rate: gstRate,
          gst_amount: gstAmount,
          total,
          payment_due_at: paymentDueFromPeriodEnd(periodEnd),
        })
        .select("id")
        .single();
      if (!inserted.error && inserted.data) {
        inv = inserted.data as { id: string };
        invErr = null;
        break;
      }
      invErr = inserted.error;
      if (!/duplicate|unique|invoice_number/i.test(inserted.error?.message ?? "")) {
        break;
      }
    }
    if (invErr || !inv)
      return fail("DB_ERROR", invErr?.message ?? "Invoice failed");
    invoiceId = inv.id;
  }

  const { error: linesErr } = await db.from("invoice_lines").insert(
    lines.map((l) => ({ ...l, invoice_id: invoiceId })),
  );
  if (linesErr) return fail("DB_ERROR", linesErr.message);

  await db.from("generated_documents").insert({
    order_id: o.id,
    invoice_id: invoiceId,
    kind: "invoice",
    title: `${invoiceNumber} (${parsed.data.kind})`,
  });

  revalidatePath("/billing");
  return ok({ invoice_id: invoiceId });
}

/** Compile remaining unbilled days as final (or interim if still on hire).
 *  If hire days are already billed but QC fees remain, create a fees-only final.
 *  Soft-skips when nothing is left to bill (no scary error for operators). */
export async function compileInvoiceAction(
  input: unknown,
): Promise<
  ActionResult<{ invoice_id?: string; skipped?: boolean; reason?: string }>
> {
  const parsed = z.object({ order_id: z.string().guid() }).safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data: order } = await db
    .from("orders")
    .select("id, start_at, end_at, off_rent_at, status")
    .eq("id", parsed.data.order_id)
    .single();
  if (!order) return fail("DB_ERROR", "Order missing");
  const o = order as {
    id: string;
    start_at: string;
    end_at: string;
    off_rent_at: string | null;
    status: string;
  };

  const hireEnd = toDateOnly(o.off_rent_at ?? o.end_at);
  const hireStart = await effectiveHireStartForOrder(db, o.id, o.start_at);
  const start = await nextUnbilledStart(db, o.id, hireStart);
  const kind =
    o.status === "returned" || o.off_rent_at ? "final" : "interim";

  if (start <= hireEnd) {
    return compilePeriodInvoiceAction({
      order_id: o.id,
      period_start: start,
      period_end: hireEnd,
      kind,
    });
  }

  // No unbilled hire days — maybe QC fees still need a final draft
  const { data: existingFinal } = await db
    .from("invoices")
    .select("id")
    .eq("order_id", o.id)
    .eq("kind", "final")
    .neq("status", "void")
    .limit(1)
    .maybeSingle();
  if (existingFinal) {
    return ok({
      skipped: true,
      reason: "Already fully billed — nothing left to invoice",
    });
  }

  const { data: items } = await db
    .from("order_items")
    .select("id")
    .eq("order_id", o.id);
  const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
  let hasQcFees = false;
  if (itemIds.length > 0) {
    const { data: asgs } = await db
      .from("order_asset_assignments")
      .select(
        "damaged, damage_fee, dirty, cleaning_fee, missing, missing_fee, meter_overage_fee",
      )
      .in("order_item_id", itemIds)
      .not("returned_at", "is", null);
    for (const raw of asgs ?? []) {
      if (hasBillableQcFees(raw as QcFeeFields)) {
        hasQcFees = true;
        break;
      }
    }
  }

  if (hasQcFees) {
    return compilePeriodInvoiceAction({
      order_id: o.id,
      period_start: hireEnd,
      period_end: hireEnd,
      kind: "final",
      fees_only: true,
    });
  }

  return ok({
    skipped: true,
    reason: "No hire days or fees to bill",
  });
}

export async function runMonthEndBillingAction(
  input: unknown,
): Promise<ActionResult<{ created: number; skipped: number }>> {
  const parsed = monthEndSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const { year, month } = parsed.data;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = lastDayOfMonth(year, month - 1);
  const db = await rentalDb();

  const { data: orders } = await db
    .from("orders")
    .select("id, start_at, end_at, off_rent_at, status")
    .in("status", ["dispatched", "off_rent_pending", "returned"]);

  let created = 0;
  let skipped = 0;

  for (const raw of orders ?? []) {
    const o = raw as {
      id: string;
      start_at: string;
      end_at: string;
      off_rent_at: string | null;
      status: string;
    };
    const hireStart = await effectiveHireStartForOrder(db, o.id, o.start_at);
    const hireEnd = toDateOnly(o.off_rent_at ?? o.end_at);
    const unbilledStart = await nextUnbilledStart(db, o.id, hireStart);
    const sliceStart = maxDate(unbilledStart, monthStart, hireStart);
    const sliceEnd = minDate(monthEnd, hireEnd);
    if (sliceStart > sliceEnd) {
      skipped += 1;
      continue;
    }
    // Only interim for periods that end on month-end while hire continues past month
    const continues =
      hireEnd > monthEnd && o.status !== "returned";
    const kind = continues ? "interim" : "final";
    const result = await compilePeriodInvoiceAction({
      order_id: o.id,
      period_start: sliceStart,
      period_end: sliceEnd,
      kind,
    });
    if (result.success) created += 1;
    else skipped += 1;
  }

  revalidatePath("/billing");
  return ok({ created, skipped });
}

export async function applyDiscountAction(
  input: unknown,
): Promise<ActionResult<{ invoice_id: string }>> {
  const parsed = discountSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data: inv, error } = await db
    .from("invoices")
    .select("id, subtotal, gst_amount, gst_rate, status")
    .eq("id", parsed.data.invoice_id)
    .single();
  if (error || !inv) return fail("DB_ERROR", error?.message ?? "Missing invoice");
  const row = inv as {
    id: string;
    subtotal: number;
    gst_amount: number;
    gst_rate: number;
    status: string;
  };
  if (row.status !== "draft") return fail("STATE", "Only draft invoices can be edited");

  const subtotalAfter = round(asNumber(row.subtotal) - parsed.data.discount_amount);
  const gstRate = asNumber(row.gst_rate) || COMPANY.gstRate;
  const gstAmount = round(Math.max(0, subtotalAfter) * gstRate);
  const total = round(subtotalAfter + gstAmount);

  const { error: updErr } = await db
    .from("invoices")
    .update({
      discount_amount: parsed.data.discount_amount,
      gst_amount: gstAmount,
      total,
      notes: parsed.data.notes,
    })
    .eq("id", row.id);
  if (updErr) return fail("DB_ERROR", updErr.message);

  await db.from("invoice_lines").delete().eq("invoice_id", row.id).eq("kind", "discount");
  if (parsed.data.discount_amount > 0) {
    await db.from("invoice_lines").insert({
      invoice_id: row.id,
      kind: "discount",
      description: "Manager discount",
      quantity: 1,
      unit_amount: -parsed.data.discount_amount,
      line_total: -parsed.data.discount_amount,
      sort_order: 999,
    });
  }

  revalidatePath("/billing");
  return ok({ invoice_id: row.id });
}

export async function approveInvoiceAction(
  input: unknown,
): Promise<ActionResult<{ invoice_id: string }>> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data: userData } = await db.auth.getUser();
  const { data: inv, error } = await db
    .from("invoices")
    .select("id, order_id, status, kind, period_end")
    .eq("id", parsed.data.invoice_id)
    .single();
  if (error || !inv) return fail("DB_ERROR", error?.message ?? "Missing");
  const row = inv as {
    id: string;
    order_id: string;
    status: string;
    kind: string;
    period_end: string | null;
  };
  if (row.status !== "draft") return fail("STATE", "Invoice is not draft");

  let paymentDueAt: string | null = row.period_end;
  const { data: orderClient } = await db
    .from("orders")
    .select("client_id, clients(payment_terms_days)")
    .eq("id", row.order_id)
    .single();
  if (orderClient) {
    const oc = orderClient as {
      clients:
        | { payment_terms_days: number }
        | { payment_terms_days: number }[]
        | null;
    };
    const client = Array.isArray(oc.clients) ? oc.clients[0] : oc.clients;
    const terms = client?.payment_terms_days ?? 30;
    const base = row.period_end
      ? new Date(row.period_end)
      : new Date();
    base.setUTCDate(base.getUTCDate() + terms);
    paymentDueAt = base.toISOString().slice(0, 10);
  }

  const { error: updErr } = await db
    .from("invoices")
    .update({
      status: "approved",
      approved_by: userData.user?.id ?? null,
      approved_at: new Date().toISOString(),
      payment_due_at: paymentDueAt,
    })
    .eq("id", row.id);
  if (updErr) return fail("DB_ERROR", updErr.message);

  // Only close hire on final invoice approval
  if (row.kind === "final") {
    await db.from("orders").update({ status: "invoiced" }).eq("id", row.order_id);
    const { releaseAssetsForClosedOrder } = await import(
      "@/features/orders/inventory-lock"
    );
    await releaseAssetsForClosedOrder(row.order_id);
  }

  revalidatePath("/billing");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/availability");
  revalidatePath("/admin/orders/new");
  return ok({ invoice_id: row.id });
}

export async function markInvoiceSentAction(
  invoiceId: string,
): Promise<ActionResult<{ invoice_id: string; mailto: string }>> {
  const { sendInvoiceEmailAction } = await import(
    "@/features/orders/email-actions"
  );
  const sent = await sendInvoiceEmailAction(invoiceId);
  if (!sent.success) return sent;
  return ok({ invoice_id: invoiceId, mailto: sent.data.mailto });
}

export async function markInvoicePaidAction(
  input: unknown,
): Promise<ActionResult<{ invoice_id: string }>> {
  const schema = z.object({
    invoice_id: z.string().guid(),
    paid_amount: z.number().nonnegative().optional(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data: inv } = await db
    .from("invoices")
    .select("id, total, status")
    .eq("id", parsed.data.invoice_id)
    .single();
  if (!inv) return fail("DB_ERROR", "Missing");
  const row = inv as { id: string; total: number; status: string };
  if (row.status !== "approved") {
    return fail("STATE", "Approve invoice before recording payment");
  }
  const { error } = await db
    .from("invoices")
    .update({
      // Paid is tracked via paid_at (invoice_status enum has no "paid")
      paid_at: new Date().toISOString(),
      paid_amount: parsed.data.paid_amount ?? asNumber(row.total),
    })
    .eq("id", row.id);
  if (error) return fail("DB_ERROR", error.message);
  revalidatePath("/billing");
  return ok({ invoice_id: row.id });
}

export async function markInvoiceAccountingSyncedAction(
  invoiceId: string,
): Promise<ActionResult<{ invoice_id: string }>> {
  const db = await rentalDb();
  const { data: inv } = await db
    .from("invoices")
    .select("id, status, invoice_number")
    .eq("id", invoiceId)
    .single();
  if (!inv) return fail("DB_ERROR", "Invoice missing");
  const row = inv as { id: string; status: string; invoice_number: string };
  if (row.status !== "approved") {
    return fail("STATE", "Approve invoice before marking synced to Xero");
  }
  const { error } = await db
    .from("invoices")
    .update({
      accounting_synced_at: new Date().toISOString(),
      accounting_export_ref: `XERO-${row.invoice_number}`,
    })
    .eq("id", row.id);
  if (error) return fail("DB_ERROR", error.message);
  revalidatePath("/billing");
  return ok({ invoice_id: row.id });
}

async function recalculateDraftTotals(
  db: Awaited<ReturnType<typeof rentalDb>>,
  invoiceId: string,
): Promise<ActionResult<{ invoice_id: string }>> {
  const { data: inv } = await db
    .from("invoices")
    .select("id, status, gst_rate, discount_amount")
    .eq("id", invoiceId)
    .single();
  if (!inv) return fail("DB_ERROR", "Invoice missing");
  const row = inv as {
    id: string;
    status: string;
    gst_rate: number;
    discount_amount: number;
  };
  if (row.status !== "draft") {
    return fail("STATE", "Only draft invoices can be edited");
  }

  const { data: lines } = await db
    .from("invoice_lines")
    .select("kind, line_total")
    .eq("invoice_id", invoiceId);

  const subtotal = round(
    (lines ?? [])
      .filter((l) => (l as { kind: string }).kind !== "discount")
      .reduce(
        (s, l) => s + asNumber((l as { line_total: number }).line_total),
        0,
      ),
  );
  const discount = asNumber(row.discount_amount);
  const gstRate = asNumber(row.gst_rate) || COMPANY.gstRate;
  const subtotalAfter = round(subtotal - discount);
  const gstAmount = round(Math.max(0, subtotalAfter) * gstRate);
  const total = round(subtotalAfter + gstAmount);

  const { error } = await db
    .from("invoices")
    .update({
      subtotal,
      gst_amount: gstAmount,
      total,
    })
    .eq("id", invoiceId);
  if (error) return fail("DB_ERROR", error.message);
  revalidatePath("/billing");
  revalidatePath(`/billing/invoices/${invoiceId}/export`);
  return ok({ invoice_id: invoiceId });
}

/** Finance: change unit amount on a draft line (qty kept; line_total = qty × unit). */
export async function updateDraftInvoiceLineAction(
  input: unknown,
): Promise<ActionResult<{ invoice_id: string }>> {
  const schema = z.object({
    line_id: z.string().guid(),
    unit_amount: z.number(),
    quantity: z.number().positive().optional(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data: line } = await db
    .from("invoice_lines")
    .select("id, invoice_id, quantity, invoices!inner(status)")
    .eq("id", parsed.data.line_id)
    .single();
  if (!line) return fail("DB_ERROR", "Line missing");
  const row = line as {
    id: string;
    invoice_id: string;
    quantity: number;
    invoices: { status: string } | { status: string }[];
  };
  const inv = Array.isArray(row.invoices) ? row.invoices[0] : row.invoices;
  if (inv?.status !== "draft") {
    return fail("STATE", "Only draft invoice lines can be edited");
  }
  const qty = parsed.data.quantity ?? (asNumber(row.quantity) || 1);
  const unit = parsed.data.unit_amount;
  const { error } = await db
    .from("invoice_lines")
    .update({
      quantity: qty,
      unit_amount: unit,
      line_total: round(qty * unit),
    })
    .eq("id", row.id);
  if (error) return fail("DB_ERROR", error.message);
  return recalculateDraftTotals(db, row.invoice_id);
}

/** Finance: add an extra charge line on a draft (cannot remove existing lines). */
export async function addDraftInvoiceLineAction(
  input: unknown,
): Promise<ActionResult<{ invoice_id: string; line_id: string }>> {
  const schema = z.object({
    invoice_id: z.string().guid(),
    kind: z
      .enum(["damage", "other", "fuel", "meter_overage", "rental"])
      .default("other"),
    description: z.string().min(2),
    quantity: z.number().positive().default(1),
    unit_amount: z.number(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data: inv } = await db
    .from("invoices")
    .select("id, status")
    .eq("id", parsed.data.invoice_id)
    .single();
  if (!inv) return fail("DB_ERROR", "Invoice missing");
  if ((inv as { status: string }).status !== "draft") {
    return fail("STATE", "Only draft invoices can gain lines");
  }
  const { data: maxSort } = await db
    .from("invoice_lines")
    .select("sort_order")
    .eq("invoice_id", parsed.data.invoice_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort =
    asNumber((maxSort as { sort_order?: number } | null)?.sort_order) + 1;
  const qty = parsed.data.quantity;
  const unit = parsed.data.unit_amount;
  const { data: created, error } = await db
    .from("invoice_lines")
    .insert({
      invoice_id: parsed.data.invoice_id,
      kind: parsed.data.kind,
      description: parsed.data.description.trim(),
      quantity: qty,
      unit_amount: unit,
      line_total: round(qty * unit),
      sort_order: nextSort,
    })
    .select("id")
    .single();
  if (error || !created) {
    return fail("DB_ERROR", error?.message ?? "Could not add line");
  }
  const totals = await recalculateDraftTotals(db, parsed.data.invoice_id);
  if (!totals.success) return totals;
  return ok({
    invoice_id: parsed.data.invoice_id,
    line_id: (created as { id: string }).id,
  });
}

function formatAu(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function maxDate(...dates: string[]): string {
  return dates.reduce((a, b) => (a > b ? a : b));
}

function minDate(...dates: string[]): string {
  return dates.reduce((a, b) => (a < b ? a : b));
}

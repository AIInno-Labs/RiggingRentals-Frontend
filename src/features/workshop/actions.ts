"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  billableDaysBetween,
  calculateMeterOverage,
} from "@/features/pricing/calculate-rate";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

const dispatchSchema = z.object({
  order_id: z.string().guid(),
  assignments: z
    .array(
      z.object({
        order_item_id: z.string().guid(),
        asset_id: z.string().guid(),
        dispatch_meter: z.number().nonnegative().default(0),
        pack_weight_kg: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
});

const offRentSchema = z.object({
  order_id: z.string().guid(),
  off_rent_at: z.string().min(1),
});

const returnSchema = z.object({
  assignment_id: z.string().guid(),
  return_meter: z.number().nonnegative().default(0),
  inspection_notes: z.string().default(""),
  damaged: z.boolean().default(false),
  damage_fee: z.number().nonnegative().default(0),
  dirty: z.boolean().default(false),
  cleaning_fee: z.number().nonnegative().default(0),
  missing: z.boolean().default(false),
  missing_fee: z.number().nonnegative().default(0),
});

const packSchema = z.object({
  assignment_id: z.string().guid(),
  pack_weight_kg: z.number().nonnegative().optional(),
  cert_checked: z.boolean().default(true),
});

const removeDocketSchema = z.object({
  assignment_id: z.string().guid(),
});

const turnaroundSchema = z.object({
  asset_id: z.string().guid(),
});

export async function markReadyForDispatchAction(
  input: unknown,
): Promise<ActionResult<{ order_id: string }>> {
  const parsed = dispatchSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();

  const { data: orderRow } = await db
    .from("orders")
    .select("id, status, client_id, payment_required, payment_status")
    .eq("id", parsed.data.order_id)
    .single();
  if (!orderRow) return fail("DB_ERROR", "Order not found");
  const o = orderRow as {
    id: string;
    status: string;
    client_id: string;
    payment_required: boolean;
    payment_status: string;
  };
  if (!["confirmed", "pre_pick"].includes(o.status)) {
    return fail(
      "VALIDATION_ERROR",
      "Order must be confirmed (or already ready) before packing",
    );
  }

  const { assertClientCanTransact } = await import(
    "@/features/billing/credit-check"
  );
  const credit = await assertClientCanTransact(o.client_id);
  if (!credit.success) return credit;

  if (
    o.payment_required &&
    !["paid", "held"].includes(o.payment_status)
  ) {
    return fail(
      "PAYMENT_REQUIRED",
      "Non-credit customer. Record deposit/payment (held or paid) before dispatch",
    );
  }

  const { data: lineItems } = await db
    .from("order_items")
    .select("id, quantity")
    .eq("order_id", parsed.data.order_id);
  const qtyByItem = new Map(
    (lineItems ?? []).map((row) => {
      const r = row as { id: string; quantity: number };
      return [r.id, r.quantity] as const;
    }),
  );
  const assetIds = parsed.data.assignments.map((a) => a.asset_id);
  if (new Set(assetIds).size !== assetIds.length) {
    return fail("VALIDATION_ERROR", "Each RRP unit can only be assigned once");
  }
  for (const [itemId, qty] of qtyByItem) {
    const count = parsed.data.assignments.filter(
      (a) => a.order_item_id === itemId,
    ).length;
    if (count !== qty) {
      return fail(
        "VALIDATION_ERROR",
        `Assign ${qty} RRP unit${qty === 1 ? "" : "s"} for every line before packing`,
      );
    }
  }
  for (const a of parsed.data.assignments) {
    if (!qtyByItem.has(a.order_item_id)) {
      return fail("VALIDATION_ERROR", "Assignment does not belong to this order");
    }
  }

  const { data: certRows } = await db
    .from("equipment_assets")
    .select("id, serial_number, certificate_expires_at, certificate_number")
    .in("id", assetIds);
  const today = new Date().toISOString().slice(0, 10);
  const expired = (certRows ?? []).filter((r) => {
    const row = r as { certificate_expires_at: string | null; serial_number: string };
    return row.certificate_expires_at && row.certificate_expires_at < today;
  });
  if (expired.length > 0) {
    const { getCurrentProfile } = await import("@/features/rbac/get-current-profile");
    const profile = await getCurrentProfile();
    if (profile?.role !== "super_admin") {
      const labels = expired
        .map((r) => (r as { serial_number: string }).serial_number)
        .join(", ");
      return fail(
        "CERT_EXPIRED",
        `Cannot pack. Certificate expired: ${labels}. Update certs in Catalog.`,
      );
    }
  }

  for (const a of parsed.data.assignments) {
    const { error } = await db.from("order_asset_assignments").upsert(
      {
        order_item_id: a.order_item_id,
        asset_id: a.asset_id,
        dispatch_meter: a.dispatch_meter,
        pack_weight_kg: a.pack_weight_kg ?? null,
        cert_checked_at: new Date().toISOString(),
        dispatched_at: null,
        reserved_at: new Date().toISOString(),
      },
      { onConflict: "order_item_id,asset_id" },
    );
    if (error) return fail("DB_ERROR", error.message);

    const { error: assetError } = await db
      .from("equipment_assets")
      .update({
        status: "reserved",
        meter_hours: a.dispatch_meter,
      })
      .eq("id", a.asset_id);
    if (assetError) return fail("DB_ERROR", assetError.message);
  }

  // Drop stale pack rows so re-picking / qty changes cannot leave orphan serials.
  const keep = new Set(
    parsed.data.assignments.map((a) => `${a.order_item_id}:${a.asset_id}`),
  );
  const itemIds = [...new Set(parsed.data.assignments.map((a) => a.order_item_id))];
  const { data: existingAsgs } = await db
    .from("order_asset_assignments")
    .select("id, order_item_id, asset_id")
    .in("order_item_id", itemIds)
    .is("dispatched_at", null);
  for (const raw of existingAsgs ?? []) {
    const row = raw as { id: string; order_item_id: string; asset_id: string };
    if (keep.has(`${row.order_item_id}:${row.asset_id}`)) continue;
    const { error: delErr } = await db
      .from("order_asset_assignments")
      .delete()
      .eq("id", row.id);
    if (delErr) return fail("DB_ERROR", delErr.message);
    await db
      .from("equipment_assets")
      .update({ status: "available" })
      .eq("id", row.asset_id)
      .eq("status", "reserved");
  }

  const { error: orderError } = await db
    .from("orders")
    .update({ status: "pre_pick" })
    .eq("id", parsed.data.order_id);
  if (orderError) return fail("DB_ERROR", orderError.message);

  revalidatePath("/workshop");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/availability");
  return ok({ order_id: parsed.data.order_id });
}

export async function dispatchOrderAction(
  input: unknown,
): Promise<ActionResult<{ order_id: string }>> {
  const schema = z.object({ order_id: z.string().guid() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();

  const { data: orderRow } = await db
    .from("orders")
    .select("id, status")
    .eq("id", parsed.data.order_id)
    .single();
  if (!orderRow) return fail("DB_ERROR", "Order not found");
  if ((orderRow as { status: string }).status !== "pre_pick") {
    return fail(
      "VALIDATION_ERROR",
      "Mark the job Ready for dispatch before sending gear to site",
    );
  }

  const { data: items } = await db
    .from("order_items")
    .select("id, quantity")
    .eq("order_id", parsed.data.order_id);
  const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
  if (itemIds.length === 0) {
    return fail("VALIDATION_ERROR", "No order lines to dispatch");
  }

  const needed = (items ?? []).reduce(
    (sum, row) => sum + (row as { quantity: number }).quantity,
    0,
  );
  const { data: asgs } = await db
    .from("order_asset_assignments")
    .select("id, asset_id, dispatch_meter")
    .in("order_item_id", itemIds);
  if (!asgs || asgs.length === 0) {
    return fail("VALIDATION_ERROR", "Assign RRP units and mark Ready for dispatch first");
  }
  if (asgs.length < needed) {
    return fail(
      "VALIDATION_ERROR",
      `Assign all RRP units before dispatch (need ${needed}, have ${asgs.length})`,
    );
  }

  const now = new Date().toISOString();
  for (const raw of asgs) {
    const a = raw as {
      id: string;
      asset_id: string;
      dispatch_meter: number | null;
    };
    const { error } = await db
      .from("order_asset_assignments")
      .update({ dispatched_at: now })
      .eq("id", a.id);
    if (error) return fail("DB_ERROR", error.message);

    const { error: assetError } = await db
      .from("equipment_assets")
      .update({
        status: "on_hire",
        meter_hours: asNumber(a.dispatch_meter),
      })
      .eq("id", a.asset_id);
    if (assetError) return fail("DB_ERROR", assetError.message);
  }

  const { error: orderError } = await db
    .from("orders")
    .update({ status: "dispatched" })
    .eq("id", parsed.data.order_id);
  if (orderError) return fail("DB_ERROR", orderError.message);

  revalidatePath("/workshop");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/availability");
  return ok({ order_id: parsed.data.order_id });
}

export async function revertDispatchAction(
  input: unknown,
): Promise<ActionResult<{ order_id: string }>> {
  const { getCurrentProfile } = await import("@/features/rbac/get-current-profile");
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return fail("FORBIDDEN", "Only Super Admin can revert dispatch");
  }
  const schema = z.object({ order_id: z.string().guid() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();

  const { data: orderRow } = await db
    .from("orders")
    .select("id, status")
    .eq("id", parsed.data.order_id)
    .single();
  if (!orderRow) return fail("DB_ERROR", "Order not found");
  if ((orderRow as { status: string }).status !== "dispatched") {
    return fail("VALIDATION_ERROR", "Only dispatched jobs can be reverted");
  }

  const { count: invCount } = await db
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("order_id", parsed.data.order_id);
  if ((invCount ?? 0) > 0) {
    return fail(
      "VALIDATION_ERROR",
      "Cannot revert. This hire already has invoices.",
    );
  }

  const { data: items } = await db
    .from("order_items")
    .select("id")
    .eq("order_id", parsed.data.order_id);
  const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
  const { data: asgs } =
    itemIds.length > 0
      ? await db
          .from("order_asset_assignments")
          .select("id, asset_id")
          .in("order_item_id", itemIds)
      : { data: [] as unknown[] };

  for (const raw of asgs ?? []) {
    const a = raw as { id: string; asset_id: string };
    await db
      .from("order_asset_assignments")
      .update({ dispatched_at: null })
      .eq("id", a.id);
    await db
      .from("equipment_assets")
      .update({ status: "reserved" })
      .eq("id", a.asset_id);
  }

  const { error } = await db
    .from("orders")
    .update({ status: "pre_pick" })
    .eq("id", parsed.data.order_id);
  if (error) return fail("DB_ERROR", error.message);

  revalidatePath("/workshop");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/availability");
  return ok({ order_id: parsed.data.order_id });
}

export async function requestOffRentAction(
  input: unknown,
): Promise<ActionResult<{ order_id: string }>> {
  const parsed = offRentSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { error } = await db
    .from("orders")
    .update({
      off_rent_at: parsed.data.off_rent_at,
      status: "off_rent_pending",
    })
    .eq("id", parsed.data.order_id);
  if (error) return fail("DB_ERROR", error.message);
  revalidatePath("/workshop");
  revalidatePath("/admin/pipeline");
  return ok({ order_id: parsed.data.order_id });
}

export async function returnAssignmentAction(
  input: unknown,
): Promise<
  ActionResult<{
    assignment_id: string;
    invoice_drafted?: boolean;
    order_closed?: boolean;
  }>
> {
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();

  const { data: assignment, error: aErr } = await db
    .from("order_asset_assignments")
    .select(
      "id, asset_id, dispatch_meter, order_item_id, order_items!inner(order_id, overage_rate_per_hour, orders!inner(id, start_at, end_at, off_rent_at))",
    )
    .eq("id", parsed.data.assignment_id)
    .single();

  if (aErr || !assignment) {
    return fail("DB_ERROR", aErr?.message ?? "Assignment not found");
  }

  const row = assignment as unknown as {
    id: string;
    asset_id: string;
    dispatch_meter: number | null;
    order_item_id: string;
    order_items:
      | {
          order_id: string;
          overage_rate_per_hour: number;
          orders:
            | {
                id: string;
                start_at: string;
                end_at: string;
                off_rent_at: string | null;
              }
            | {
                id: string;
                start_at: string;
                end_at: string;
                off_rent_at: string | null;
              }[];
        }
      | {
          order_id: string;
          overage_rate_per_hour: number;
          orders:
            | {
                id: string;
                start_at: string;
                end_at: string;
                off_rent_at: string | null;
              }
            | {
                id: string;
                start_at: string;
                end_at: string;
                off_rent_at: string | null;
              }[];
        }[];
  };

  const orderItem = Array.isArray(row.order_items)
    ? row.order_items[0]
    : row.order_items;
  const order = Array.isArray(orderItem.orders)
    ? orderItem.orders[0]
    : orderItem.orders;
  const resolvedOrderId = orderItem.order_id || order.id;

  const startMeter = asNumber(row.dispatch_meter);
  const billableDays = billableDaysBetween(
    order.start_at,
    order.off_rent_at ?? order.end_at,
  );
  const overage = calculateMeterOverage({
    startMeter,
    endMeter: parsed.data.return_meter,
    billableDays,
    overageRatePerHour: asNumber(orderItem.overage_rate_per_hour),
  });

  const { error: updErr } = await db
    .from("order_asset_assignments")
    .update({
      return_meter: parsed.data.return_meter,
      inspection_notes: parsed.data.inspection_notes,
      damaged: parsed.data.damaged,
      damage_fee: parsed.data.damage_fee,
      dirty: parsed.data.dirty,
      cleaning_fee: parsed.data.cleaning_fee,
      missing: parsed.data.missing,
      missing_fee: parsed.data.missing_fee,
      meter_overage_hours: overage.overageHours,
      meter_overage_fee: overage.overageFee,
      returned_at: new Date().toISOString(),
      off_hired_at: new Date().toISOString(),
      billing_end_at: new Date().toISOString().slice(0, 10),
      removed_from_docket: true,
    })
    .eq("id", parsed.data.assignment_id);
  if (updErr) return fail("DB_ERROR", updErr.message);

  const nextStatus = parsed.data.damaged || parsed.data.missing
    ? "maintenance"
    : "in_inspection";
  const { error: assetErr } = await db
    .from("equipment_assets")
    .update({
      status: nextStatus,
      meter_hours: parsed.data.return_meter,
    })
    .eq("id", row.asset_id);
  if (assetErr) return fail("DB_ERROR", assetErr.message);

  if (parsed.data.damaged || parsed.data.missing) {
    const notes = parsed.data.inspection_notes.trim();
    await db.from("maintenance_work_orders").insert({
      asset_id: row.asset_id,
      work_type: "repair",
      status: "open",
      title: parsed.data.missing
        ? `Missing gear on return`
        : `Return damage — repair`,
      description:
        notes ||
        (parsed.data.missing
          ? `Flagged missing on return QC. Fee estimate: $${parsed.data.missing_fee}`
          : `Flagged damaged on return QC. Fee estimate: $${parsed.data.damage_fee}`),
      estimated_hours: 4,
      parts_cost: 0,
      labor_cost: 0,
      due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Partial return: close hire only when every unit is back
  const { data: siblings } = await db
    .from("order_asset_assignments")
    .select("id, returned_at, order_items!inner(order_id)")
    .eq("order_items.order_id", resolvedOrderId);
  const allBack =
    (siblings ?? []).length > 0 &&
    (siblings ?? []).every(
      (s) => !!(s as { returned_at: string | null }).returned_at,
    );
  let invoiceDrafted = true;
  if (allBack) {
    await db
      .from("orders")
      .update({
        status: "returned",
        off_rent_at: new Date().toISOString(),
      })
      .eq("id", resolvedOrderId);
    const { compileInvoiceAction } = await import("@/features/billing/actions");
    const inv = await compileInvoiceAction({ order_id: resolvedOrderId });
    invoiceDrafted =
      inv.success && !inv.data.skipped && !!inv.data.invoice_id;
  }

  revalidatePath("/workshop");
  revalidatePath("/workshop/repairs");
  revalidatePath("/admin/maintenance");
  revalidatePath("/billing");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/availability");
  revalidatePath("/admin/orders/new");
  return ok({
    assignment_id: parsed.data.assignment_id,
    invoice_drafted: invoiceDrafted,
    order_closed: allBack,
  });
}

export async function savePackDetailsAction(
  input: unknown,
): Promise<ActionResult<{ assignment_id: string }>> {
  const parsed = packSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const patch: Record<string, string | number | null> = {};
  if (parsed.data.pack_weight_kg !== undefined) {
    patch.pack_weight_kg = parsed.data.pack_weight_kg;
  }
  if (parsed.data.cert_checked) {
    patch.cert_checked_at = new Date().toISOString();
  }
  const { error } = await db
    .from("order_asset_assignments")
    .update(patch)
    .eq("id", parsed.data.assignment_id);
  if (error) return fail("DB_ERROR", error.message);
  revalidatePath("/workshop");
  return ok({ assignment_id: parsed.data.assignment_id });
}

export async function removeFromDocketAction(
  input: unknown,
): Promise<ActionResult<{ assignment_id: string }>> {
  const parsed = removeDocketSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data: asg } = await db
    .from("order_asset_assignments")
    .select("id, returned_at")
    .eq("id", parsed.data.assignment_id)
    .single();
  if (!asg) return fail("DB_ERROR", "Assignment missing");
  if (!(asg as { returned_at: string | null }).returned_at) {
    return fail("STATE", "Complete return QC before removing from docket");
  }
  const { error } = await db
    .from("order_asset_assignments")
    .update({ removed_from_docket: true })
    .eq("id", parsed.data.assignment_id);
  if (error) return fail("DB_ERROR", error.message);
  revalidatePath("/workshop");
  return ok({ assignment_id: parsed.data.assignment_id });
}

export async function completeTurnaroundAction(
  input: unknown,
): Promise<ActionResult<{ asset_id: string }>> {
  const parsed = turnaroundSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { error } = await db
    .from("equipment_assets")
    .update({ status: "available" })
    .eq("id", parsed.data.asset_id)
    .eq("status", "in_inspection");
  if (error) return fail("DB_ERROR", error.message);
  revalidatePath("/workshop");
  revalidatePath("/admin/catalog");
  return ok({ asset_id: parsed.data.asset_id });
}

export async function markOrderReturnedAction(
  orderId: string,
): Promise<ActionResult<{ order_id: string; invoice_drafted?: boolean }>> {
  const idParsed = z.string().guid().safeParse(orderId);
  if (!idParsed.success) return fail("VALIDATION_ERROR", "Invalid order id");
  const db = await rentalDb();

  // QC required: every assigned serial must have Finish return check first.
  const { data: items } = await db
    .from("order_items")
    .select("id")
    .eq("order_id", orderId);
  const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
  if (itemIds.length === 0) {
    return fail(
      "VALIDATION_ERROR",
      "No line items — cannot close return without QC",
    );
  }
  const { data: asgs } = await db
    .from("order_asset_assignments")
    .select("id, returned_at")
    .in("order_item_id", itemIds);
  if (!asgs || asgs.length === 0) {
    return fail(
      "VALIDATION_ERROR",
      "No RRP units assigned — complete dispatch and return QC first",
    );
  }
  const pendingQc = asgs.filter(
    (a) => !(a as { returned_at: string | null }).returned_at,
  ).length;
  if (pendingQc > 0) {
    return fail(
      "VALIDATION_ERROR",
      `Return QC required on ${pendingQc} RRP unit(s) before closing to Finance`,
    );
  }

  const { error } = await db
    .from("orders")
    .update({
      status: "returned",
      off_rent_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) return fail("DB_ERROR", error.message);

  const { releaseAssetsForClosedOrder } = await import(
    "@/features/orders/inventory-lock"
  );
  const released = await releaseAssetsForClosedOrder(orderId);
  if (!released.success) return released;

  // Finance owns approve; return auto-opens a FINAL draft for remaining unbilled days.
  const { compileInvoiceAction } = await import("@/features/billing/actions");
  const inv = await compileInvoiceAction({ order_id: orderId });

  revalidatePath("/workshop");
  revalidatePath("/billing");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/availability");
  revalidatePath("/admin/orders/new");
  return ok({
    order_id: orderId,
    invoice_drafted:
      inv.success && !inv.data.skipped && !!inv.data.invoice_id,
  });
}

export async function saveAttachmentAction(input: unknown): Promise<
  ActionResult<{ id: string }>
> {
  const schema = z.object({
    order_id: z.string().guid(),
    assignment_id: z.string().guid().optional(),
    kind: z.enum([
      "dispatch",
      "return",
      "damage",
      "acceptance",
      "picking_slip",
      "return_notes",
    ]),
    storage_path: z.string().min(1),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data: userData } = await db.auth.getUser();
  const { data, error } = await db
    .from("order_attachments")
    .insert({
      ...parsed.data,
      created_by: userData.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return fail("DB_ERROR", error?.message ?? "Insert failed");
  return ok({ id: (data as { id: string }).id });
}

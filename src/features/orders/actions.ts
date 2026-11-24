"use server";

import { revalidatePath } from "next/cache";
import { checkAvailabilityAction } from "@/features/availability/actions";
import {
  createOrderSchema,
  updateOrderStatusSchema,
} from "@/features/orders/schemas";
import { asNumber, rentalDb } from "@/lib/supabase/rental-db";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { requireProfile } from "@/features/rbac/require-role";

export async function createOrderAction(
  input: unknown,
): Promise<ActionResult<{ id: string; order_number: string }>> {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }

  const db = await rentalDb();

  const productItems = parsed.data.items.filter((i) => !!i.catalog_id);
  for (const item of productItems) {
    const avail = await checkAvailabilityAction({
      catalogId: item.catalog_id,
      startAt: parsed.data.start_at,
      endAt: parsed.data.end_at,
      requestedQty: item.quantity,
    });
    if (!avail.success) return avail;
    if (!avail.data.isAvailable) {
      const { data: cat } = await db
        .from("equipment_catalog")
        .select("sku, name")
        .eq("id", item.catalog_id)
        .maybeSingle();
      const label = cat
        ? `${(cat as { sku: string }).sku} — ${(cat as { name: string }).name}`
        : "catalog item";
      return fail(
        "UNAVAILABLE",
        `Need ${item.quantity}× ${label} for these dates but ${avail.data.availableQty} are free (${avail.data.yardIdle} in yard — other quotes/hires hold the rest).`,
      );
    }
  }

  const { data: userData } = await db.auth.getUser();
  const { data: orderNo, error: orderNoError } = await db.rpc(
    "next_order_number",
  );
  if (orderNoError || typeof orderNo !== "string" || !orderNo.trim()) {
    return fail(
      "DB_ERROR",
      orderNoError?.message ??
        "Could not allocate order number — contact support",
    );
  }
  const orderNumber = orderNo.trim();

  const catalogIds = productItems.map((i) => i.catalog_id);
  const categories = [
    ...new Set(parsed.data.items.map((i) => i.category.trim()).filter(Boolean)),
  ];

  const [{ data: catalogRows, error: catalogError }, { data: categoryRows }] =
    await Promise.all([
      catalogIds.length
        ? db
            .from("equipment_catalog")
            .select(
              "id, category, daily_rate, weekly_rate, monthly_rate, overage_rate_per_hour, default_fuel_surcharge",
            )
            .in("id", catalogIds)
        : Promise.resolve({ data: [] as unknown[], error: null }),
      categories.length
        ? db
            .from("equipment_catalog")
            .select("category, daily_rate, weekly_rate, monthly_rate")
            .eq("is_active", true)
            .in("category", categories)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

  if (catalogError) {
    return fail("DB_ERROR", catalogError.message ?? "Catalog lookup failed");
  }

  const catalogMap = new Map(
    (catalogRows ?? []).map((c) => {
      const row = c as {
        id: string;
        category: string;
        daily_rate: number;
        weekly_rate: number;
        monthly_rate: number;
        overage_rate_per_hour: number;
        default_fuel_surcharge: number;
      };
      return [row.id, row] as const;
    }),
  );

  const categoryAvg = new Map<
    string,
    { daily: number; weekly: number; monthly: number; n: number }
  >();
  for (const row of categoryRows ?? []) {
    const r = row as {
      category: string;
      daily_rate: number;
      weekly_rate: number;
      monthly_rate: number;
    };
    const cur = categoryAvg.get(r.category) ?? {
      daily: 0,
      weekly: 0,
      monthly: 0,
      n: 0,
    };
    cur.daily += asNumber(r.daily_rate);
    cur.weekly += asNumber(r.weekly_rate);
    cur.monthly += asNumber(r.monthly_rate);
    cur.n += 1;
    categoryAvg.set(r.category, cur);
  }

  let fuel = parsed.data.fuel_surcharge;
  if (fuel === 0) {
    fuel = productItems.reduce((sum, item) => {
      const c = catalogMap.get(item.catalog_id);
      return sum + asNumber(c?.default_fuel_surcharge) * item.quantity;
    }, 0);
  }

  const { data: clientRow } = await db
    .from("clients")
    .select("id, credit_account")
    .eq("id", parsed.data.client_id)
    .single();
  const creditAccount =
    (clientRow as { credit_account?: boolean } | null)?.credit_account !== false;
  const paymentRequired = !creditAccount;

  const quoteValidUntil = new Date();
  quoteValidUntil.setUTCDate(quoteValidUntil.getUTCDate() + 30);

  let order: { id: string; order_number: string } | null = null;
  let orderError: { message: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    let attemptOrderNumber = orderNumber;
    if (attempt > 0) {
      const retry = await db.rpc("next_order_number");
      if (retry.error || typeof retry.data !== "string" || !retry.data.trim()) {
        return fail(
          "DB_ERROR",
          retry.error?.message ?? "Could not allocate order number on retry",
        );
      }
      attemptOrderNumber = retry.data.trim();
    }

    const result = await db
      .from("orders")
      .insert({
        order_number: attemptOrderNumber,
        client_id: parsed.data.client_id,
        status: "draft",
        start_at: parsed.data.start_at,
        end_at: parsed.data.end_at,
        damage_waiver: parsed.data.damage_waiver,
        fuel_surcharge: fuel,
        security_deposit: parsed.data.security_deposit,
        notes: parsed.data.notes,
        jobsite_name: parsed.data.jobsite_name,
        delivery_address: parsed.data.delivery_address,
        purchase_order: parsed.data.purchase_order,
        delivery_required: parsed.data.delivery_required,
        pickup_required: parsed.data.pickup_required,
        quote_valid_until: quoteValidUntil.toISOString().slice(0, 10),
        quote_notes: parsed.data.notes,
        payment_required: paymentRequired,
        payment_status: paymentRequired ? "pending" : "not_required",
        created_by: userData.user?.id ?? null,
      })
      .select("id, order_number")
      .single();

    order = result.data as { id: string; order_number: string } | null;
    orderError = result.error;

    if (!orderError) break;
    if (!orderError.message.includes("orders_order_number_key")) break;
  }

  if (orderError || !order) {
    return fail("DB_ERROR", orderError?.message ?? "Order insert failed");
  }

  const orderId = (order as { id: string; order_number: string }).id;
  const itemsPayload = parsed.data.items.map((item) => {
    const c = item.catalog_id ? catalogMap.get(item.catalog_id) : undefined;
    const avg = categoryAvg.get(item.category);
    const suggestedDaily =
      asNumber(c?.daily_rate) ||
      (avg && avg.n ? avg.daily / avg.n : 0);
    const suggestedWeekly =
      asNumber(c?.weekly_rate) ||
      (avg && avg.n ? avg.weekly / avg.n : 0);
    const suggestedMonthly =
      asNumber(c?.monthly_rate) ||
      (avg && avg.n ? avg.monthly / avg.n : 0);
    const override = item.rate_override === true;
    return {
      order_id: orderId,
      catalog_id: item.catalog_id || null,
      category: item.category,
      quantity: item.quantity,
      daily_rate: override
        ? asNumber(item.daily_rate ?? suggestedDaily)
        : suggestedDaily,
      weekly_rate: override
        ? asNumber(item.weekly_rate ?? suggestedWeekly)
        : suggestedWeekly,
      monthly_rate: override
        ? asNumber(item.monthly_rate ?? suggestedMonthly)
        : suggestedMonthly,
      overage_rate_per_hour: asNumber(c?.overage_rate_per_hour),
      line_notes: item.line_notes,
      rate_override: override,
    };
  });

  const { error: itemsError } = await db.from("order_items").insert(itemsPayload);
  if (itemsError) return fail("DB_ERROR", itemsError.message);

  await db.from("generated_documents").insert({
    order_id: orderId,
    kind: "quote",
    title: `Quotation ${(order as { order_number: string }).order_number}`,
  });

  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/orders");
  return ok({
    id: orderId,
    order_number: (order as { order_number: string }).order_number,
  });
}

export async function updateDraftOrderAction(
  input: unknown,
): Promise<ActionResult<{ id: string; order_number: string }>> {
  const auth = await requireProfile();
  if (!auth.success) return auth;
  const { updateDraftOrderSchema } = await import("@/features/orders/schemas");
  const parsed = updateDraftOrderSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }

  const db = await rentalDb();
  const { data: existing, error: loadErr } = await db
    .from("orders")
    .select("id, order_number, status")
    .eq("id", parsed.data.order_id)
    .maybeSingle();
  if (loadErr || !existing) {
    return fail("DB_ERROR", loadErr?.message ?? "Order not found");
  }
  const row = existing as { id: string; order_number: string; status: string };
  if (row.status !== "draft") {
    return fail("VALIDATION_ERROR", "Only draft quotes can be edited");
  }

  const productItems = parsed.data.items.filter((i) => !!i.catalog_id);
  for (const item of productItems) {
    const avail = await checkAvailabilityAction({
      catalogId: item.catalog_id,
      startAt: parsed.data.start_at,
      endAt: parsed.data.end_at,
      requestedQty: item.quantity,
      excludeOrderId: parsed.data.order_id,
    });
    if (!avail.success) return avail;
    if (!avail.data.isAvailable) {
      return fail(
        "AVAILABILITY",
        `Not enough free units for one of the lines on these dates.`,
      );
    }
  }

  const catalogIds = [
    ...new Set(productItems.map((i) => i.catalog_id).filter(Boolean)),
  ];
  const { data: catalogRows } = catalogIds.length
    ? await db
        .from("equipment_catalog")
        .select(
          "id, daily_rate, weekly_rate, monthly_rate, overage_rate_per_hour, category",
        )
        .in("id", catalogIds)
    : { data: [] as unknown[] };
  const catalogMap = new Map(
    (catalogRows ?? []).map((c) => {
      const r = c as {
        id: string;
        daily_rate: number;
        weekly_rate: number;
        monthly_rate: number;
        overage_rate_per_hour: number;
        category: string;
      };
      return [r.id, r] as const;
    }),
  );

  const { data: allCat } = await db
    .from("equipment_catalog")
    .select("category, daily_rate, weekly_rate, monthly_rate")
    .eq("is_active", true);
  const categoryAvg = new Map<
    string,
    { daily: number; weekly: number; monthly: number; n: number }
  >();
  for (const c of allCat ?? []) {
    const r = c as {
      category: string;
      daily_rate: number;
      weekly_rate: number;
      monthly_rate: number;
    };
    const cur = categoryAvg.get(r.category) ?? {
      daily: 0,
      weekly: 0,
      monthly: 0,
      n: 0,
    };
    cur.daily += asNumber(r.daily_rate);
    cur.weekly += asNumber(r.weekly_rate);
    cur.monthly += asNumber(r.monthly_rate);
    cur.n += 1;
    categoryAvg.set(r.category, cur);
  }

  const { data: clientRow } = await db
    .from("clients")
    .select("credit_account")
    .eq("id", parsed.data.client_id)
    .maybeSingle();
  const creditAccount = !!(clientRow as { credit_account?: boolean } | null)
    ?.credit_account;
  const paymentRequired = !creditAccount;

  const quoteValidUntil = new Date();
  quoteValidUntil.setDate(quoteValidUntil.getDate() + 30);

  const { error: updErr } = await db
    .from("orders")
    .update({
      client_id: parsed.data.client_id,
      start_at: parsed.data.start_at,
      end_at: parsed.data.end_at,
      damage_waiver: parsed.data.damage_waiver,
      fuel_surcharge: parsed.data.fuel_surcharge,
      security_deposit: parsed.data.security_deposit,
      notes: parsed.data.notes,
      quote_notes: parsed.data.notes,
      jobsite_name: parsed.data.jobsite_name,
      delivery_address: parsed.data.delivery_address,
      purchase_order: parsed.data.purchase_order,
      delivery_required: parsed.data.delivery_required,
      pickup_required: parsed.data.pickup_required,
      quote_valid_until: quoteValidUntil.toISOString().slice(0, 10),
      payment_required: paymentRequired,
      payment_status: paymentRequired ? "pending" : "not_required",
    })
    .eq("id", parsed.data.order_id);
  if (updErr) return fail("DB_ERROR", updErr.message);

  const { error: delErr } = await db
    .from("order_items")
    .delete()
    .eq("order_id", parsed.data.order_id);
  if (delErr) return fail("DB_ERROR", delErr.message);

  const itemsPayload = parsed.data.items.map((item) => {
    const c = item.catalog_id ? catalogMap.get(item.catalog_id) : undefined;
    const avg = categoryAvg.get(item.category);
    const suggestedDaily =
      asNumber(c?.daily_rate) ||
      (avg && avg.n ? avg.daily / avg.n : 0);
    const suggestedWeekly =
      asNumber(c?.weekly_rate) ||
      (avg && avg.n ? avg.weekly / avg.n : 0);
    const suggestedMonthly =
      asNumber(c?.monthly_rate) ||
      (avg && avg.n ? avg.monthly / avg.n : 0);
    const override = item.rate_override === true;
    return {
      order_id: parsed.data.order_id,
      catalog_id: item.catalog_id || null,
      category: item.category,
      quantity: item.quantity,
      daily_rate: override
        ? asNumber(item.daily_rate ?? suggestedDaily)
        : suggestedDaily,
      weekly_rate: override
        ? asNumber(item.weekly_rate ?? suggestedWeekly)
        : suggestedWeekly,
      monthly_rate: override
        ? asNumber(item.monthly_rate ?? suggestedMonthly)
        : suggestedMonthly,
      overage_rate_per_hour: asNumber(c?.overage_rate_per_hour),
      line_notes: item.line_notes,
      rate_override: override,
    };
  });

  const { error: itemsError } = await db.from("order_items").insert(itemsPayload);
  if (itemsError) return fail("DB_ERROR", itemsError.message);

  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.order_id}`);
  return ok({ id: row.id, order_number: row.order_number });
}

export async function updateLineNotesAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireProfile();
  if (!auth.success) return auth;
  const { updateLineNotesSchema } = await import("@/features/orders/schemas");
  const parsed = updateLineNotesSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data: item, error: findErr } = await db
    .from("order_items")
    .select("id, order_id")
    .eq("id", parsed.data.order_item_id)
    .maybeSingle();
  if (findErr || !item) {
    return fail("DB_ERROR", findErr?.message ?? "Line not found");
  }
  const { error } = await db
    .from("order_items")
    .update({ line_notes: parsed.data.line_notes })
    .eq("id", parsed.data.order_item_id);
  if (error) return fail("DB_ERROR", error.message);
  const orderId = (item as { order_id: string }).order_id;
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/workshop/orders/${orderId}/delivery-docket`);
  revalidatePath("/workshop");
  return ok({ id: parsed.data.order_item_id });
}

export async function updateOrderNotesAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireProfile();
  if (!auth.success) return auth;
  const { updateOrderNotesSchema } = await import("@/features/orders/schemas");
  const parsed = updateOrderNotesSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }

  const db = await rentalDb();
  const { error } = await db
    .from("orders")
    .update({
      quote_notes: parsed.data.quote_notes,
      notes: parsed.data.notes,
    })
    .eq("id", parsed.data.order_id);
  if (error) return fail("DB_ERROR", error.message);

  revalidatePath(`/admin/orders/${parsed.data.order_id}`);
  revalidatePath(`/admin/orders/${parsed.data.order_id}/documents/quote`);
  revalidatePath(`/workshop/orders/${parsed.data.order_id}/picking-slip`);
  revalidatePath("/admin/pipeline");
  return ok({ id: parsed.data.order_id });
}

export async function updateOrderStatusAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }

  const { getCurrentProfile } = await import("@/features/rbac/get-current-profile");
  const profile = await getCurrentProfile();
  if (profile?.role === "sales") {
    const allowed =
      parsed.data.status === "confirmed" || parsed.data.status === "cancelled";
    if (!allowed) {
      return fail(
        "FORBIDDEN",
        "Sales can only confirm quotes or cancel. Workshop/Finance own later steps.",
      );
    }
  }
  if (profile?.role === "sales" && parsed.data.status === "invoiced") {
    return fail("FORBIDDEN", "Finance owns invoicing");
  }

  const db = await rentalDb();

  if (parsed.data.status === "confirmed") {
    const { data: order } = await db
      .from("orders")
      .select(
        "id, client_id, start_at, end_at, payment_required, payment_status, status, accepted_hire_agreement_at",
      )
      .eq("id", parsed.data.order_id)
      .single();
    const { data: items } = await db
      .from("order_items")
      .select("catalog_id, category, quantity")
      .eq("order_id", parsed.data.order_id);

    if (order && items) {
      const o = order as {
        client_id: string;
        start_at: string;
        end_at: string;
        payment_required: boolean;
        payment_status: string;
        accepted_hire_agreement_at: string | null;
      };

      if (!o.accepted_hire_agreement_at) {
        return fail(
          "ACCEPTANCE_REQUIRED",
          "Record hire T&Cs acceptance on the order first (who accepted + how).",
        );
      }

      const unresolved = items.filter(
        (row) => !(row as { catalog_id: string | null }).catalog_id,
      );
      if (unresolved.length > 0) {
        const cats = unresolved
          .map((row) => (row as { category: string }).category || "line")
          .join(", ");
        return fail(
          "PRODUCT_REQUIRED",
          `Assign a sub category to every quote line before confirm (${cats}). Category-only lines are draft-only.`,
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
          "Non-credit customer. Record deposit/payment (held or paid) before confirm",
        );
      }
      for (const item of items) {
        const it = item as { catalog_id: string; quantity: number };
        const avail = await checkAvailabilityAction({
          catalogId: it.catalog_id,
          startAt: o.start_at,
          endAt: o.end_at,
          requestedQty: it.quantity,
          excludeOrderId: parsed.data.order_id,
        });
        if (!avail.success) return avail;
        if (!avail.data.isAvailable) {
          const { data: cat } = await db
            .from("equipment_catalog")
            .select("sku, name")
            .eq("id", it.catalog_id)
            .maybeSingle();
          const label = cat
            ? `${(cat as { sku: string }).sku} — ${(cat as { name: string }).name}`
            : "catalog item";
          return fail(
            "UNAVAILABLE",
            `Cannot confirm — need ${it.quantity}× ${label} for these dates but ${avail.data.availableQty} are free (${avail.data.yardIdle} in yard).`,
          );
        }
      }
    }
  }

  if (parsed.data.status === "cancelled") {
    const { releaseReservedAssetsForOrder } = await import(
      "@/features/orders/inventory-lock"
    );
    await releaseReservedAssetsForOrder(parsed.data.order_id);
  }

  const patch: Record<string, string | null> = { status: parsed.data.status };

  const { error } = await db
    .from("orders")
    .update(patch)
    .eq("id", parsed.data.order_id);

  if (error) return fail("DB_ERROR", error.message);

  if (parsed.data.status === "confirmed") {
    const { reserveAssetsForOrder } = await import(
      "@/features/orders/inventory-lock"
    );
    const locked = await reserveAssetsForOrder(parsed.data.order_id);
    if (!locked.success) {
      // roll back confirm
      await db
        .from("orders")
        .update({ status: "draft" })
        .eq("id", parsed.data.order_id);
      return locked;
    }

    await db.from("generated_documents").insert({
      order_id: parsed.data.order_id,
      kind: "hire_agreement",
      title: "Hire agreement issued on confirm",
    });
    await db
      .from("orders")
      .update({
        charging_started_at: new Date().toISOString(),
        status: "pre_pick",
      })
      .eq("id", parsed.data.order_id);

    const { data: orderRow } = await db
      .from("orders")
      .select("start_at, delivery_address, delivery_required, end_at, pickup_required, off_rent_at")
      .eq("id", parsed.data.order_id)
      .single();
    const o = orderRow as {
      start_at: string;
      end_at: string;
      delivery_address: string;
      delivery_required: boolean;
      pickup_required: boolean;
    } | null;
    if (o?.delivery_required) {
      await db.from("delivery_tasks").insert({
        order_id: parsed.data.order_id,
        task_type: "delivery",
        status: "scheduled",
        scheduled_at: o.start_at,
        address: o.delivery_address,
        driver_notes: "Auto-created on confirm",
      });
    }

    // Auto-send confirm + TnC email (Resend when configured)
    try {
      const { sendOrderConfirmEmailAction } = await import(
        "@/features/orders/email-actions"
      );
      await sendOrderConfirmEmailAction(parsed.data.order_id);
    } catch {
      // non-blocking
    }
  }

  if (parsed.data.status === "off_rent_pending") {
    const { data: orderRow } = await db
      .from("orders")
      .select("off_rent_at, end_at, delivery_address, pickup_required")
      .eq("id", parsed.data.order_id)
      .single();
    const o = orderRow as {
      off_rent_at: string | null;
      end_at: string;
      delivery_address: string;
      pickup_required: boolean;
    } | null;
    if (o?.pickup_required) {
      await db.from("delivery_tasks").insert({
        order_id: parsed.data.order_id,
        task_type: "pickup",
        status: "scheduled",
        scheduled_at: o.off_rent_at ?? o.end_at,
        address: o.delivery_address,
        driver_notes: "Auto-created on off-rent",
      });
    }
  }

  revalidatePath("/admin/pipeline");
  revalidatePath("/workshop");
  revalidatePath("/admin");
  revalidatePath("/admin/logistics");
  revalidatePath("/billing");
  return ok({ id: parsed.data.order_id });
}

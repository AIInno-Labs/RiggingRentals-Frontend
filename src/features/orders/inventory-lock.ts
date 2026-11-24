"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

/** Hard inventory lock: reserve physical serials for confirmed order lines. */
export async function reserveAssetsForOrder(
  orderId: string,
): Promise<ActionResult<{ reserved: number }>> {
  const db = await rentalDb();
  const today = new Date().toISOString().slice(0, 10);
  const { data: items } = await db
    .from("order_items")
    .select("id, catalog_id, quantity")
    .eq("order_id", orderId);
  if (!items?.length) return ok({ reserved: 0 });

  const catalogIds = [
    ...new Set(
      (items as { catalog_id: string }[]).map((i) => i.catalog_id),
    ),
  ];
  const { data: catalogs } = await db
    .from("equipment_catalog")
    .select("id, sku, name")
    .in("id", catalogIds);
  const labelById = new Map(
    (catalogs ?? []).map((c) => {
      const row = c as { id: string; sku: string; name: string };
      return [row.id, `${row.sku} — ${row.name}`] as const;
    }),
  );

  let reserved = 0;
  for (const raw of items) {
    const item = raw as {
      id: string;
      catalog_id: string;
      quantity: number;
    };
    const label = labelById.get(item.catalog_id) ?? "a catalog line";

    const { data: existing } = await db
      .from("order_asset_assignments")
      .select("id")
      .eq("order_item_id", item.id);
    const already = existing?.length ?? 0;
    const need = Math.max(0, item.quantity - already);
    if (need === 0) continue;

    const { data: candidates } = await db
      .from("equipment_assets")
      .select("id, meter_hours, certificate_expires_at")
      .eq("catalog_id", item.catalog_id)
      .eq("status", "available")
      .order("serial_number");

    const free = (candidates ?? [])
      .filter((a) => {
        const exp = (a as { certificate_expires_at: string | null })
          .certificate_expires_at;
        return !exp || exp >= today;
      })
      .slice(0, need) as { id: string; meter_hours: number }[];

    if (free.length < need) {
      const have = already + free.length;
      return fail(
        "UNAVAILABLE",
        `Cannot lock inventory for ${label} — need ${item.quantity} unit(s) with valid certificates, only ${have} available (including any already assigned)`,
      );
    }

    for (const asset of free) {
      const { error: asgErr } = await db.from("order_asset_assignments").insert({
        order_item_id: item.id,
        asset_id: asset.id,
        dispatch_meter: asNumber(asset.meter_hours),
        reserved_at: new Date().toISOString(),
      });
      if (asgErr) return fail("DB_ERROR", asgErr.message);
      const { error: stErr } = await db
        .from("equipment_assets")
        .update({ status: "reserved" })
        .eq("id", asset.id)
        .eq("status", "available");
      if (stErr) return fail("DB_ERROR", stErr.message);
      reserved += 1;
    }
  }
  return ok({ reserved });
}

export async function releaseReservedAssetsForOrder(
  orderId: string,
): Promise<ActionResult<{ released: number }>> {
  const db = await rentalDb();
  const { data: items } = await db
    .from("order_items")
    .select("id")
    .eq("order_id", orderId);
  const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
  if (itemIds.length === 0) return ok({ released: 0 });

  const { data: asgs } = await db
    .from("order_asset_assignments")
    .select("id, asset_id, dispatched_at, returned_at")
    .in("order_item_id", itemIds);

  let released = 0;
  for (const raw of asgs ?? []) {
    const a = raw as {
      id: string;
      asset_id: string;
      dispatched_at: string | null;
      returned_at: string | null;
    };
    if (a.dispatched_at || a.returned_at) continue;
    await db.from("order_asset_assignments").delete().eq("id", a.id);
    await db
      .from("equipment_assets")
      .update({ status: "available" })
      .eq("id", a.asset_id)
      .eq("status", "reserved");
    released += 1;
  }
  return ok({ released });
}

/** After return or final invoice: put reserved/on-hire serials back in the yard. */
export async function releaseAssetsForClosedOrder(
  orderId: string,
): Promise<ActionResult<{ released: number }>> {
  const db = await rentalDb();
  const { data: items } = await db
    .from("order_items")
    .select("id")
    .eq("order_id", orderId);
  const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
  if (itemIds.length === 0) return ok({ released: 0 });

  const { data: asgs } = await db
    .from("order_asset_assignments")
    .select("id, asset_id, returned_at")
    .in("order_item_id", itemIds);

  const now = new Date().toISOString();
  let released = 0;
  for (const raw of asgs ?? []) {
    const a = raw as {
      id: string;
      asset_id: string;
      returned_at: string | null;
    };
    if (!a.returned_at) {
      const { error: asgErr } = await db
        .from("order_asset_assignments")
        .update({
          returned_at: now,
          off_hired_at: now,
          removed_from_docket: true,
        })
        .eq("id", a.id);
      if (asgErr) return fail("DB_ERROR", asgErr.message);
    }

    const { data: asset, error: assetErr } = await db
      .from("equipment_assets")
      .select("id, status")
      .eq("id", a.asset_id)
      .single();
    if (assetErr) return fail("DB_ERROR", assetErr.message);
    const st = (asset as { status: string } | null)?.status;
    if (st !== "reserved" && st !== "on_hire") continue;

    const { error: stErr } = await db
      .from("equipment_assets")
      .update({ status: "available" })
      .eq("id", a.asset_id)
      .in("status", ["reserved", "on_hire"]);
    if (stErr) return fail("DB_ERROR", stErr.message);
    released += 1;
  }
  return ok({ released });
}

export async function recordOrderPaymentAction(
  input: unknown,
): Promise<ActionResult<{ order_id: string }>> {
  const schema = z.object({
    order_id: z.string().guid(),
    payment_hold_ref: z.string().default(""),
    mark: z.enum(["held", "paid"]),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { error } = await db
    .from("orders")
    .update({
      payment_status: parsed.data.mark,
      payment_hold_ref: parsed.data.payment_hold_ref,
      payment_recorded_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.order_id);
  if (error) return fail("DB_ERROR", error.message);
  revalidatePath("/admin/pipeline");
  revalidatePath(`/admin/orders/${parsed.data.order_id}`);
  return ok({ order_id: parsed.data.order_id });
}

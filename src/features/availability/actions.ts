"use server";

import { z } from "zod";
import {
  availabilityInputSchema,
  computeAvailability,
  type AssetRow,
  type OrderDemandRow,
} from "@/features/availability/compute-availability";
import type { AssetStatus, OrderStatus } from "@/features/domain/types";
import { rentalDb } from "@/lib/supabase/rental-db";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import type { AvailabilityResult } from "@/features/availability/compute-availability";

const ORDERS_JOIN =
  "quantity, catalog_id, order_id, orders!inner(id, status, start_at, end_at, off_rent_at)";

function demandFromItem(row: unknown): (OrderDemandRow & { catalog_id: string }) | null {
  const r = row as {
    quantity: number;
    catalog_id: string;
    order_id: string;
    orders:
      | {
          id: string;
          status: OrderStatus;
          start_at: string;
          end_at: string;
          off_rent_at: string | null;
        }
      | {
          id: string;
          status: OrderStatus;
          start_at: string;
          end_at: string;
          off_rent_at: string | null;
        }[]
      | null;
  };
  const order = Array.isArray(r.orders) ? r.orders[0] : r.orders;
  if (!order) return null;
  return {
    catalog_id: r.catalog_id,
    order_id: r.order_id,
    status: order.status,
    start_at: order.start_at,
    end_at: order.end_at,
    off_rent_at: order.off_rent_at,
    quantity: r.quantity,
  };
}

export async function checkAvailabilityAction(
  input: unknown,
): Promise<ActionResult<AvailabilityResult>> {
  const parsed = availabilityInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }

  const db = await rentalDb();
  const { catalogId, startAt, endAt, requestedQty, excludeOrderId } = parsed.data;

  const { data: assets, error: assetError } = await db
    .from("equipment_assets")
    .select("id, status, certificate_expires_at")
    .eq("catalog_id", catalogId);

  if (assetError) return fail("DB_ERROR", assetError.message);

  const { data: itemRows, error: itemError } = await db
    .from("order_items")
    .select(ORDERS_JOIN)
    .eq("catalog_id", catalogId);

  if (itemError) return fail("DB_ERROR", itemError.message);

  const demands: OrderDemandRow[] = (itemRows ?? [])
    .map(demandFromItem)
    .filter((d): d is OrderDemandRow & { catalog_id: string } => d !== null);

  const result = computeAvailability({
    catalogId,
    startAt,
    endAt,
    requestedQty,
    excludeOrderId,
    assets: (assets ?? []).map((a) => ({
      id: String((a as { id: string }).id),
      status: (a as { status: AssetStatus }).status,
      certificate_expires_at: (
        a as { certificate_expires_at?: string | null }
      ).certificate_expires_at,
    })),
    demands,
  });

  return ok(result);
}

const windowSchema = z.object({
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  excludeOrderId: z.string().guid().optional(),
});

/** Date-window free qty per catalog (same rules as save/confirm). */
export async function checkWindowAvailabilityAction(
  input: unknown,
): Promise<ActionResult<Record<string, number>>> {
  const parsed = windowSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }

  const db = await rentalDb();
  const [{ data: assets, error: assetError }, { data: itemRows, error: itemError }] =
    await Promise.all([
      db
        .from("equipment_assets")
        .select("id, catalog_id, status, certificate_expires_at"),
      db.from("order_items").select(ORDERS_JOIN),
    ]);
  if (assetError) return fail("DB_ERROR", assetError.message);
  if (itemError) return fail("DB_ERROR", itemError.message);

  const assetsByCat = new Map<string, AssetRow[]>();
  for (const row of assets ?? []) {
    const a = row as {
      id: string;
      catalog_id: string;
      status: AssetStatus;
      certificate_expires_at?: string | null;
    };
    const list = assetsByCat.get(a.catalog_id) ?? [];
    list.push({
      id: a.id,
      status: a.status,
      certificate_expires_at: a.certificate_expires_at,
    });
    assetsByCat.set(a.catalog_id, list);
  }

  const demandsByCat = new Map<string, OrderDemandRow[]>();
  for (const row of itemRows ?? []) {
    const d = demandFromItem(row);
    if (!d) continue;
    const list = demandsByCat.get(d.catalog_id) ?? [];
    list.push(d);
    demandsByCat.set(d.catalog_id, list);
  }

  const qty: Record<string, number> = {};
  for (const catalogId of assetsByCat.keys()) {
    qty[catalogId] = computeAvailability({
      catalogId,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      requestedQty: 1,
      excludeOrderId: parsed.data.excludeOrderId,
      assets: assetsByCat.get(catalogId) ?? [],
      demands: demandsByCat.get(catalogId) ?? [],
    }).availableQty;
  }
  return ok(qty);
}

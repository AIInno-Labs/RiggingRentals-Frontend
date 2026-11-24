import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { ACTIVE_ORDER_STATUSES } from "@/features/domain/types";
import {
  certBlocksHire,
  rangesOverlap,
} from "@/features/availability/compute-availability";

export type HirePressureRow = {
  catalog_id: string;
  sku: string;
  name: string;
  category: string;
  fleet: number;
  capacity: number;
  peak_booked: number;
  shortfall: number;
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

/** Peak concurrent hire demand vs yard capacity for the next N days. */
export async function getHirePressure(
  dayCount = 14,
  limit = 6,
): Promise<HirePressureRow[]> {
  const db = await rentalDb();
  const windowStart = new Date();
  windowStart.setUTCHours(0, 0, 0, 0);
  const windowEnd = addDays(windowStart, dayCount);
  windowEnd.setUTCHours(23, 59, 59, 999);

  const [{ data: catalog }, { data: assets }, { data: items }] =
    await Promise.all([
      db
        .from("equipment_catalog")
        .select("id, sku, name, category")
        .eq("is_active", true),
      db
        .from("equipment_assets")
        .select("id, catalog_id, status, certificate_expires_at"),
      db
        .from("order_items")
        .select(
          "catalog_id, quantity, orders!inner(id, status, start_at, end_at, off_rent_at)",
        )
        .not("catalog_id", "is", null),
    ]);

  const assetsByCatalog = new Map<
    string,
    {
      status: string;
      certificate_expires_at?: string | null;
    }[]
  >();
  for (const row of assets ?? []) {
    const a = row as {
      catalog_id: string;
      status: string;
      certificate_expires_at?: string | null;
    };
    const list = assetsByCatalog.get(a.catalog_id) ?? [];
    list.push(a);
    assetsByCatalog.set(a.catalog_id, list);
  }

  type Demand = {
    catalog_id: string;
    quantity: number;
    start: Date;
    end: Date;
  };
  const demands: Demand[] = [];
  const active = new Set(ACTIVE_ORDER_STATUSES);

  for (const row of items ?? []) {
    const r = row as {
      catalog_id: string | null;
      quantity: number;
      orders:
        | {
            status: string;
            start_at: string;
            end_at: string;
            off_rent_at: string | null;
          }
        | {
            status: string;
            start_at: string;
            end_at: string;
            off_rent_at: string | null;
          }[];
    };
    if (!r.catalog_id) continue;
    const o = Array.isArray(r.orders) ? r.orders[0] : r.orders;
    if (!o || !active.has(o.status as (typeof ACTIVE_ORDER_STATUSES)[number])) {
      continue;
    }
    const start = new Date(o.start_at);
    const end = new Date(o.off_rent_at ?? o.end_at);
    if (!rangesOverlap(start, end, windowStart, windowEnd)) continue;
    demands.push({
      catalog_id: r.catalog_id,
      quantity: asNumber(r.quantity),
      start,
      end,
    });
  }

  const days: Date[] = [];
  for (let i = 0; i < dayCount; i++) {
    days.push(addDays(windowStart, i));
  }

  const rows: HirePressureRow[] = [];
  for (const cat of catalog ?? []) {
    const c = cat as {
      id: string;
      sku: string;
      name: string;
      category: string | null;
    };
    const fleetAssets = (assetsByCatalog.get(c.id) ?? []).filter(
      (a) => a.status !== "retired",
    );
    const fleet = fleetAssets.length;
    if (fleet === 0 && !demands.some((d) => d.catalog_id === c.id)) continue;

    let peak = 0;
    for (const day of days) {
      const dayStart = new Date(`${isoDay(day)}T00:00:00.000Z`);
      const dayEnd = new Date(`${isoDay(day)}T23:59:59.999Z`);
      const booked = demands
        .filter(
          (d) =>
            d.catalog_id === c.id &&
            rangesOverlap(d.start, d.end, dayStart, dayEnd),
        )
        .reduce((s, d) => s + d.quantity, 0);
      if (booked > peak) peak = booked;
    }

    const unavailable = fleetAssets.filter(
      (a) =>
        ["maintenance", "in_inspection"].includes(a.status) ||
        certBlocksHire(a.certificate_expires_at, windowStart),
    ).length;
    const capacity = Math.max(0, fleet - unavailable);
    const shortfall = Math.max(0, peak - capacity);

    if (peak === 0 && shortfall === 0) continue;

    rows.push({
      catalog_id: c.id,
      sku: c.sku,
      name: c.name,
      category: c.category?.trim() || "—",
      fleet,
      capacity,
      peak_booked: peak,
      shortfall,
    });
  }

  rows.sort((a, b) => {
    if (b.shortfall !== a.shortfall) return b.shortfall - a.shortfall;
    if (b.peak_booked !== a.peak_booked) return b.peak_booked - a.peak_booked;
    return a.sku.localeCompare(b.sku);
  });

  return rows.slice(0, limit);
}

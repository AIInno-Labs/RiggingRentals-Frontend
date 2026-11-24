import { rentalDb } from "@/lib/supabase/rental-db";
import { AvailabilityGrid } from "@/features/availability/components/availability-grid";
import type {
  AvailabilityBooking,
  AvailabilityHold,
  AvailabilityRow,
} from "@/features/availability/components/availability-grid";
import { ACTIVE_ORDER_STATUSES } from "@/features/domain/types";
import { certBlocksHire } from "@/features/availability/compute-availability";
import { FleetTabs } from "@/features/availability/components/fleet-tabs";
import { FleetPriceList } from "@/features/availability/components/fleet-price-list";
import { asNumber } from "@/lib/supabase/rental-db";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 31;

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDay(raw?: string): Date | null {
  if (!raw || !DAY_RE.test(raw)) return null;
  const d = new Date(`${raw}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveWindow(fromRaw?: string, toRaw?: string) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  let from = parseDay(fromRaw) ?? today;
  let to = parseDay(toRaw);
  if (!to) {
    to = new Date(from);
    to.setDate(from.getDate() + 13);
  }
  if (to < from) {
    const swap = from;
    from = to;
    to = swap;
  }
  const span =
    Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (span > MAX_DAYS) {
    to = new Date(from);
    to.setDate(from.getDate() + MAX_DAYS - 1);
  }
  const days: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    days.push(localDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return {
    days,
    from: localDayKey(from),
    to: localDayKey(to),
  };
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "rates" ? "rates" : "yard";
  const { days, from, to } = resolveWindow(sp.from, sp.to);
  const db = await rentalDb();
  const [{ data: catalog }, { data: assets }, { data: items }, { data: wos }] =
    await Promise.all([
      db
        .from("equipment_catalog")
        .select(
          "id, sku, name, category, daily_rate, weekly_rate, monthly_rate, tracks_meter",
        )
        .eq("is_active", true)
        .order("sku"),
      db
        .from("equipment_assets")
        .select("id, catalog_id, status, serial_number, certificate_expires_at"),
      db.from("order_items").select(
        "catalog_id, quantity, orders!inner(id, order_number, status, start_at, end_at, off_rent_at, clients(company_name))",
      ),
      db
        .from("maintenance_work_orders")
        .select(
          "id, title, status, due_at, asset_id, equipment_assets(catalog_id, serial_number)",
        )
        .in("status", ["open", "in_progress", "waiting_parts"]),
    ]);

  const active = new Set<string>(ACTIVE_ORDER_STATUSES);

  const bookingsByCatalog = new Map<string, AvailabilityBooking[]>();
  for (const row of items ?? []) {
    const r = row as {
      catalog_id: string;
      quantity: number;
      orders:
        | {
            id: string;
            order_number: string;
            status: string;
            start_at: string;
            end_at: string;
            off_rent_at: string | null;
            clients:
              | { company_name: string }
              | { company_name: string }[]
              | null;
          }
        | {
            id: string;
            order_number: string;
            status: string;
            start_at: string;
            end_at: string;
            off_rent_at: string | null;
            clients:
              | { company_name: string }
              | { company_name: string }[]
              | null;
          }[];
    };
    const o = Array.isArray(r.orders) ? r.orders[0] : r.orders;
    if (!o || !active.has(o.status)) continue;
    const client = Array.isArray(o.clients) ? o.clients[0] : o.clients;
    const list = bookingsByCatalog.get(r.catalog_id) ?? [];
    list.push({
      order_id: o.id,
      order_number: o.order_number,
      company_name: client?.company_name ?? "Client",
      status: o.status,
      quantity: r.quantity,
      start_at: o.start_at,
      end_at: o.off_rent_at ?? o.end_at,
    });
    bookingsByCatalog.set(r.catalog_id, list);
  }

  const holdsByCatalog = new Map<string, AvailabilityHold[]>();
  for (const row of wos ?? []) {
    const r = row as {
      id: string;
      title: string;
      status: string;
      due_at: string | null;
      equipment_assets:
        | { catalog_id: string; serial_number: string }
        | { catalog_id: string; serial_number: string }[]
        | null;
    };
    const asset = Array.isArray(r.equipment_assets)
      ? r.equipment_assets[0]
      : r.equipment_assets;
    if (!asset) continue;
    const list = holdsByCatalog.get(asset.catalog_id) ?? [];
    list.push({
      id: r.id,
      title: r.title,
      status: r.status,
      serial_number: asset.serial_number,
      due_at: r.due_at,
    });
    holdsByCatalog.set(asset.catalog_id, list);
  }

  // Assets in maintenance/inspection without open WO still count as shop hold
  for (const a of assets ?? []) {
    const row = a as {
      id: string;
      catalog_id: string;
      status: string;
      serial_number: string;
      certificate_expires_at?: string | null;
    };
    if (!["maintenance", "in_inspection"].includes(row.status)) continue;
    const existing = holdsByCatalog.get(row.catalog_id) ?? [];
    if (existing.some((h) => h.serial_number === row.serial_number)) continue;
    existing.push({
      id: `asset-${row.id}`,
      title: row.status === "in_inspection" ? "In inspection bay" : "In maintenance",
      status: row.status,
      serial_number: row.serial_number,
      due_at: null,
    });
    holdsByCatalog.set(row.catalog_id, existing);
  }

  const rangeStart = new Date(`${days[0]}T00:00:00`);
  for (const a of assets ?? []) {
    const row = a as {
      id: string;
      catalog_id: string;
      serial_number: string;
      certificate_expires_at?: string | null;
    };
    if (!certBlocksHire(row.certificate_expires_at, rangeStart)) continue;
    const existing = holdsByCatalog.get(row.catalog_id) ?? [];
    if (existing.some((h) => h.id === `cert-${row.id}`)) continue;
    existing.push({
      id: `cert-${row.id}`,
      title: `Cert expired ${row.certificate_expires_at}`,
      status: "cert_expired",
      serial_number: row.serial_number,
      due_at: row.certificate_expires_at ?? null,
    });
    holdsByCatalog.set(row.catalog_id, existing);
  }

  const rows: AvailabilityRow[] = (catalog ?? []).map((c) => {
    const cat = c as {
      id: string;
      sku: string;
      name: string;
      category?: string | null;
    };
    const physical = (assets ?? []).filter(
      (a) => (a as { catalog_id: string }).catalog_id === cat.id,
    );

    const cells = days.map((dk) => {
      const dayStart = new Date(`${dk}T00:00:00`);
      const dayEnd = new Date(`${dk}T23:59:59.999`);
      const unavailable = physical.filter((a) => {
        const row = a as {
          status: string;
          certificate_expires_at?: string | null;
        };
        if (
          ["maintenance", "in_inspection", "retired"].includes(row.status)
        ) {
          return true;
        }
        return certBlocksHire(row.certificate_expires_at, dayStart);
      }).length;
      const demand = (bookingsByCatalog.get(cat.id) ?? []).reduce((sum, b) => {
        const oStart = new Date(b.start_at);
        const oEnd = new Date(b.end_at);
        if (oStart <= dayEnd && dayStart <= oEnd) return sum + b.quantity;
        return sum;
      }, 0);
      const free = Math.max(0, physical.length - unavailable - demand);
      return { day: dk, free, physical: physical.length };
    });

    const family = (cat.category?.trim() || cat.sku.split(/[-_0-9]/)[0] || "Other");
    return {
      id: cat.id,
      sku: cat.sku,
      name: cat.name,
      family,
      cells,
      bookings: bookingsByCatalog.get(cat.id) ?? [],
      holds: holdsByCatalog.get(cat.id) ?? [],
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Fleet</h2>
          <p className="text-sm text-muted-foreground">
            Check the yard for a hire window, or look up day rates.
          </p>
        </div>
        <FleetTabs view={view} from={from} to={to} />
      </div>
      {view === "rates" ? (
        <FleetPriceList
          rows={(catalog ?? []).map((c) => {
            const row = c as {
              id: string;
              sku: string;
              name: string;
              daily_rate: number;
              weekly_rate: number;
              monthly_rate: number;
            };
            return {
              id: row.id,
              sku: row.sku,
              name: row.name,
              daily_rate: asNumber(row.daily_rate),
              weekly_rate: asNumber(row.weekly_rate),
              monthly_rate: asNumber(row.monthly_rate),
            };
          })}
        />
      ) : (
        <AvailabilityGrid days={days} from={from} to={to} rows={rows} />
      )}
    </div>
  );
}

import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { catalogLabel } from "@/lib/supabase/relations";
import { RepairBay } from "@/features/workshop/components/repair-bay";
import type { WorkOrderRow } from "@/features/operations/components/maintenance-table";

export default async function WorkshopRepairsPage({
  searchParams,
}: {
  searchParams: Promise<{ aging?: string }>;
}) {
  const sp = await searchParams;
  const aging7d = sp.aging === "7d";
  const agingCutoff = aging7d
    ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const db = await rentalDb();
  // aging=7d matches pulse shopStuck7d (any open WO ≥7d); default bay stays repair-only.
  let woQuery = db
    .from("maintenance_work_orders")
    .select(
      "id, title, description, work_type, status, due_at, created_at, estimated_hours, parts_cost, labor_cost, equipment_assets(serial_number, equipment_catalog(name, sku))",
    )
    .order("due_at", { ascending: true });

  if (agingCutoff) {
    woQuery = woQuery
      .in("status", ["open", "in_progress", "waiting_parts"])
      .lte("created_at", agingCutoff);
  } else {
    woQuery = woQuery
      .eq("work_type", "repair")
      .neq("status", "completed")
      .neq("status", "cancelled");
  }

  const { data: wos } = await woQuery;

  const { data: assets } = await db
    .from("equipment_assets")
    .select("id, serial_number, status, equipment_catalog(name, sku)")
    .in("status", ["available", "in_inspection", "maintenance"])
    .order("serial_number");

  const openOrders: WorkOrderRow[] = (wos ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      title: string;
      description: string | null;
      work_type: string;
      status: string;
      due_at: string | null;
      estimated_hours: number;
      parts_cost: number;
      labor_cost: number;
      equipment_assets:
        | {
            serial_number: string;
            equipment_catalog:
              | { name: string; sku: string }
              | { name: string; sku: string }[]
              | null;
          }
        | {
            serial_number: string;
            equipment_catalog:
              | { name: string; sku: string }
              | { name: string; sku: string }[]
              | null;
          }[]
        | null;
    };
    const asset = Array.isArray(r.equipment_assets)
      ? r.equipment_assets[0]
      : r.equipment_assets;
    return {
      id: r.id,
      title: r.title,
      description: r.description ?? "",
      work_type: r.work_type,
      status: r.status,
      due_at: r.due_at,
      estimated_hours: asNumber(r.estimated_hours),
      parts_cost: asNumber(r.parts_cost),
      labor_cost: asNumber(r.labor_cost),
      serial_number: asset?.serial_number ?? "—",
      catalog_name: catalogLabel(asset?.equipment_catalog),
    };
  });

  return (
    <RepairBay
      openOrders={openOrders}
      assets={(assets ?? []).map((a) => {
        const row = a as {
          id: string;
          serial_number: string;
          status: string;
          equipment_catalog:
            | { name: string; sku: string }
            | { name: string; sku: string }[]
            | null;
        };
        return {
          id: row.id,
          status: row.status,
          label: `${row.serial_number} · ${catalogLabel(row.equipment_catalog)} (${row.status})`,
        };
      })}
    />
  );
}

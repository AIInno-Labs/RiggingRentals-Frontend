import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { MaintenanceTable } from "@/features/operations/components/maintenance-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function MaintenancePage() {
  const db = await rentalDb();
  const { data } = await db
    .from("maintenance_work_orders")
    .select(
      "id, title, work_type, status, due_at, estimated_hours, parts_cost, labor_cost, equipment_assets(serial_number, equipment_catalog(name, sku))",
    )
    .order("due_at", { ascending: true });

  const rows = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      title: string;
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
    const catalogRaw = asset?.equipment_catalog;
    const catalog = Array.isArray(catalogRaw) ? catalogRaw[0] : catalogRaw;
    return {
      id: r.id,
      title: r.title,
      work_type: r.work_type,
      status: r.status,
      due_at: r.due_at,
      estimated_hours: asNumber(r.estimated_hours),
      parts_cost: asNumber(r.parts_cost),
      labor_cost: asNumber(r.labor_cost),
      serial_number: asset?.serial_number ?? "—",
      catalog_name: catalog ? `${catalog.sku} ${catalog.name}` : "—",
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance & service</CardTitle>
        <CardDescription>
          Preventive, repair, inspection, and turnaround work orders — core to Point of Rental / Sunbelt shop ops.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MaintenanceTable rows={rows} />
      </CardContent>
    </Card>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { catalogLabel } from "@/lib/supabase/relations";
import { getCurrentProfile } from "@/features/rbac/get-current-profile";
import {
  WorkshopJobCard,
  type AssetOption,
  type WorkshopOrder,
} from "@/features/workshop/components/workshop-job-card";

export default async function WorkshopJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { id } = await params;
  const db = await rentalDb();

  const [{ data: order }, { data: assets }, { data: items }] =
    await Promise.all([
      db
        .from("orders")
        .select("id, order_number, status, start_at, end_at, clients(company_name)")
        .eq("id", id)
        .maybeSingle(),
      db.from("equipment_assets").select(
        "id, catalog_id, serial_number, meter_hours, status, certificate_number, certificate_type, certificate_expires_at, equipment_catalog(sku, name)",
      ),
      db
        .from("order_items")
        .select(
          "id, order_id, catalog_id, quantity, line_notes, equipment_catalog(name, sku)",
        )
        .eq("order_id", id),
    ]);

  if (!order) notFound();

  const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
  const { data: assignments } =
    itemIds.length > 0
      ? await db
          .from("order_asset_assignments")
          .select(
            "id, order_item_id, asset_id, dispatch_meter, return_meter, returned_at, equipment_assets(serial_number)",
          )
          .in("order_item_id", itemIds)
      : { data: [] as unknown[] };

  const assetOptions: AssetOption[] = (assets ?? []).map((a) => {
    const row = a as {
      id: string;
      catalog_id: string;
      serial_number: string;
      meter_hours: number;
      status: string;
      certificate_number: string;
      certificate_type?: string;
      certificate_expires_at: string | null;
      equipment_catalog:
        | { sku: string; name: string }
        | { sku: string; name: string }[]
        | null;
    };
    return {
      id: row.id,
      catalog_id: row.catalog_id,
      serial_number: row.serial_number,
      meter_hours: asNumber(row.meter_hours),
      status: row.status,
      certificate_number: row.certificate_number,
      certificate_type: row.certificate_type,
      certificate_expires_at: row.certificate_expires_at,
      catalog_label: catalogLabel(row.equipment_catalog),
    };
  });

  const o = order as {
    id: string;
    order_number: string;
    status: string;
    start_at: string;
    end_at: string;
    clients: { company_name: string } | { company_name: string }[] | null;
  };
  const client = Array.isArray(o.clients) ? o.clients[0] ?? null : o.clients;

  const orderItems = (items ?? []).map((i) => {
    const it = i as {
      id: string;
      catalog_id: string;
      quantity: number;
      line_notes: string | null;
      equipment_catalog:
        | { name: string; sku: string }
        | { name: string; sku: string }[]
        | null;
    };
    return {
      id: it.id,
      catalog_id: it.catalog_id,
      quantity: it.quantity,
      catalog_name: catalogLabel(it.equipment_catalog),
      line_notes: it.line_notes ?? "",
    };
  });

  const orderAssignments = (assignments ?? []).map((a) => {
    const asg = a as {
      id: string;
      order_item_id: string;
      asset_id: string;
      dispatch_meter: number | null;
      return_meter: number | null;
      returned_at: string | null;
      equipment_assets:
        | { serial_number: string }
        | { serial_number: string }[]
        | null;
    };
    const asset = Array.isArray(asg.equipment_assets)
      ? asg.equipment_assets[0]
      : asg.equipment_assets;
    return {
      id: asg.id,
      order_item_id: asg.order_item_id,
      asset_id: asg.asset_id,
      serial_number: asset?.serial_number ?? asg.asset_id,
      dispatch_meter: asg.dispatch_meter,
      return_meter: asg.return_meter,
      returned_at: asg.returned_at,
    };
  });

  const workshopOrder: WorkshopOrder = {
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    start_at: o.start_at,
    end_at: o.end_at,
    clients: client,
    items: orderItems,
    assignments: orderAssignments,
  };

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/workshop"
          className="brand-link text-xs font-medium"
        >
          ← Back to Jobs
        </Link>
        <h2 className="font-display text-2xl font-semibold mt-1">
          Job {o.order_number}
        </h2>
      </div>

      <WorkshopJobCard
        order={workshopOrder}
        assets={assetOptions}
        canRevertDispatch={profile?.role === "super_admin"}
      />
    </div>
  );
}

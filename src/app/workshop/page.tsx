import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { catalogLabel } from "@/lib/supabase/relations";
import {
  type AssetOption,
  type WorkshopOrder,
} from "@/features/workshop/components/workshop-job-card";
import { WorkshopFloor } from "@/features/workshop/components/workshop-floor";
import { getCurrentProfile } from "@/features/rbac/get-current-profile";
import { redirect } from "next/navigation";

export default async function WorkshopPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const sp = await searchParams;

  const db = await rentalDb();

  // Orders + full fleet are independent — fetch together to cut waterfall latency.
  const [{ data: orders }, { data: assets }] = await Promise.all([
    db
      .from("orders")
      .select("id, order_number, status, start_at, end_at, clients(company_name)")
      .in("status", ["confirmed", "pre_pick", "dispatched", "off_rent_pending"])
      .order("start_at"),
    db.from("equipment_assets").select(
      "id, catalog_id, serial_number, meter_hours, status, certificate_number, certificate_type, certificate_expires_at, equipment_catalog(sku, name)",
    ),
  ]);

  const orderIds = (orders ?? []).map((o) => (o as { id: string }).id);
  const inspectionIds = (assets ?? [])
    .filter((a) => (a as { status: string }).status === "in_inspection")
    .map((a) => (a as { id: string }).id);

  const [{ data: items }, { data: recentReturns }] = await Promise.all([
    orderIds.length > 0
      ? db
          .from("order_items")
          .select(
            "id, order_id, catalog_id, quantity, line_notes, equipment_catalog(name, sku)",
          )
          .in("order_id", orderIds)
      : Promise.resolve({ data: [] as unknown[] }),
    inspectionIds.length > 0
      ? db
          .from("order_asset_assignments")
          .select(
            "asset_id, returned_at, order_items!inner(orders!inner(order_number, clients(company_name)))",
          )
          .in("asset_id", inspectionIds)
          .not("returned_at", "is", null)
          .order("returned_at", { ascending: false })
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

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

  const lastReturnByAsset = new Map<
    string,
    { order_number: string; client_name: string | null }
  >();
  for (const raw of recentReturns ?? []) {
    const row = raw as {
      asset_id: string;
      order_items:
        | {
            orders:
              | {
                  order_number: string;
                  clients:
                    | { company_name: string }
                    | { company_name: string }[]
                    | null;
                }
              | {
                  order_number: string;
                  clients:
                    | { company_name: string }
                    | { company_name: string }[]
                    | null;
                }[];
          }
        | {
            orders:
              | {
                  order_number: string;
                  clients:
                    | { company_name: string }
                    | { company_name: string }[]
                    | null;
                }
              | {
                  order_number: string;
                  clients:
                    | { company_name: string }
                    | { company_name: string }[]
                    | null;
                }[];
          }[];
    };
    if (lastReturnByAsset.has(row.asset_id)) continue;
    const item = Array.isArray(row.order_items)
      ? row.order_items[0]
      : row.order_items;
    const order = Array.isArray(item?.orders) ? item.orders[0] : item?.orders;
    if (!order) continue;
    const client = Array.isArray(order.clients)
      ? order.clients[0] ?? null
      : order.clients;
    lastReturnByAsset.set(row.asset_id, {
      order_number: order.order_number,
      client_name: client?.company_name ?? null,
    });
  }

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
    const last = lastReturnByAsset.get(row.id);
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
      last_order_number: last?.order_number ?? null,
      last_client_name: last?.client_name ?? null,
    };
  });

  const workshopOrders: WorkshopOrder[] = (orders ?? []).map((o) => {
    const row = o as {
      id: string;
      order_number: string;
      status: string;
      start_at: string;
      end_at: string;
      clients: { company_name: string } | { company_name: string }[] | null;
    };
    const client = Array.isArray(row.clients)
      ? row.clients[0] ?? null
      : row.clients;
    const orderItems = (items ?? [])
      .filter((i) => (i as { order_id: string }).order_id === row.id)
      .map((i) => {
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

    const orderAssignments = (assignments ?? [])
      .filter((a) =>
        orderItems.some(
          (it) => it.id === (a as { order_item_id: string }).order_item_id,
        ),
      )
      .map((a) => {
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

    return {
      id: row.id,
      order_number: row.order_number,
      status: row.status,
      start_at: row.start_at,
      end_at: row.end_at,
      clients: client,
      items: orderItems,
      assignments: orderAssignments,
    };
  });

  const pickJobs = workshopOrders.filter((o) =>
    ["confirmed", "pre_pick"].includes(o.status),
  );
  const onRentJobs = workshopOrders.filter((o) => o.status === "dispatched");
  const returnJobs = workshopOrders.filter(
    (o) => o.status === "off_rent_pending",
  );
  const q = (sp.q ?? "").trim().toLowerCase();
  const match = (o: WorkshopOrder) => {
    if (!q) return true;
    const company = o.clients?.company_name?.toLowerCase() ?? "";
    const serialHit = o.assignments.some((a) =>
      a.serial_number.toLowerCase().includes(q),
    );
    const catalogHit = o.items.some((i) =>
      i.catalog_name.toLowerCase().includes(q),
    );
    return (
      o.order_number.toLowerCase().includes(q) ||
      company.includes(q) ||
      serialHit ||
      catalogHit
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">Jobs</h2>
        <p className="text-sm text-muted-foreground">
          Pack, dispatch, and process equipment returns on the workshop floor.
        </p>
      </div>
      <WorkshopFloor
        pickOrders={pickJobs.filter(match)}
        onRentOrders={onRentJobs.filter(match)}
        returnOrders={returnJobs.filter(match)}
        turnaround={assetOptions}
        defaultTab={sp.tab}
        searchQuery={sp.q ?? ""}
        canRevertDispatch={profile?.role === "super_admin"}
      />
    </div>
  );
}

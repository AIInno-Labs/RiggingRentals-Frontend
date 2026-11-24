import Link from "next/link";
import { notFound } from "next/navigation";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import {
  OrderBuilderForm,
  type OrderBuilderInitial,
} from "@/features/orders/components/order-builder-form";
import { isNoiseClient } from "@/features/catalog/is-noise-client";

export default async function EditDraftOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await rentalDb();
  const { data: order } = await db
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();
  const o = order as {
    id: string;
    order_number: string;
    status: string;
    client_id: string;
    start_at: string;
    end_at: string;
    damage_waiver: boolean;
    security_deposit: number;
    fuel_surcharge: number;
    notes: string;
    quote_notes: string;
    jobsite_name: string;
    delivery_address: string;
    purchase_order: string;
    delivery_required: boolean;
    pickup_required: boolean;
  };
  if (o.status !== "draft") {
    notFound();
  }

  const [{ data: clients }, { data: catalog }, { data: assets }, { data: items }] =
    await Promise.all([
      db
        .from("clients")
        .select("id, company_name, contact_name")
        .order("company_name"),
      db
        .from("equipment_catalog")
        .select("id, sku, name, category, daily_rate, weekly_rate, monthly_rate")
        .eq("is_active", true)
        .order("sku"),
      db.from("equipment_assets").select("catalog_id, status"),
      db
        .from("order_items")
        .select(
          "category, catalog_id, quantity, daily_rate, weekly_rate, monthly_rate, rate_override, line_notes, equipment_catalog(sku, name)",
        )
        .eq("order_id", id),
    ]);

  const availByCatalog = new Map<string, number>();
  for (const a of assets ?? []) {
    const row = a as { catalog_id: string; status: string };
    if (row.status !== "available") continue;
    availByCatalog.set(
      row.catalog_id,
      (availByCatalog.get(row.catalog_id) ?? 0) + 1,
    );
  }

  const clientOpts = (clients ?? [])
    .map((c) => {
      const row = c as {
        id: string;
        company_name: string;
        contact_name: string;
      };
      return {
        id: row.id,
        company_name: row.company_name,
        contact_name: row.contact_name,
        label: `${row.company_name}${row.contact_name ? ` (${row.contact_name})` : ""}`,
      };
    })
    .filter((c) => !isNoiseClient(c));

  if (!clientOpts.some((c) => c.id === o.client_id)) {
    const raw = (clients ?? []).find(
      (c) => (c as { id: string }).id === o.client_id,
    ) as
      | { id: string; company_name: string; contact_name: string }
      | undefined;
    if (raw) {
      clientOpts.unshift({
        id: raw.id,
        company_name: raw.company_name,
        contact_name: raw.contact_name,
        label: `${raw.company_name}${raw.contact_name ? ` (${raw.contact_name})` : ""}`,
      });
    }
  }

  const catalogOpts = (catalog ?? []).map((c) => {
    const row = c as {
      id: string;
      sku: string;
      name: string;
      category: string;
      daily_rate: number;
      weekly_rate: number;
      monthly_rate: number;
    };
    return {
      id: row.id,
      label: `${row.sku} — ${row.name}`,
      category: row.category ?? "",
      daily_rate: asNumber(row.daily_rate),
      weekly_rate: asNumber(row.weekly_rate),
      monthly_rate: asNumber(row.monthly_rate),
      available_count: availByCatalog.get(row.id) ?? 0,
    };
  });

  const initial: OrderBuilderInitial = {
    orderId: o.id,
    orderNumber: o.order_number,
    clientId: o.client_id,
    startAt: o.start_at.slice(0, 10),
    endAt: o.end_at.slice(0, 10),
    damageWaiver: o.damage_waiver,
    deposit: asNumber(o.security_deposit),
    fuel: asNumber(o.fuel_surcharge),
    notes: o.quote_notes || o.notes || "",
    jobsite: o.jobsite_name ?? "",
    deliveryAddress: o.delivery_address ?? "",
    po: o.purchase_order ?? "",
    deliveryRequired: o.delivery_required,
    pickupRequired: o.pickup_required,
    lines: (items ?? []).map((raw) => {
      const it = raw as {
        category: string | null;
        catalog_id: string | null;
        quantity: number;
        daily_rate: number;
        weekly_rate: number;
        monthly_rate: number;
        rate_override: boolean;
        line_notes: string;
        equipment_catalog:
          | { sku: string; name: string }
          | { sku: string; name: string }[]
          | null;
      };
      const cat = Array.isArray(it.equipment_catalog)
        ? it.equipment_catalog[0]
        : it.equipment_catalog;
      return {
        category: it.category ?? "",
        catalog_id: it.catalog_id ?? "",
        quantity: it.quantity,
        daily_rate: asNumber(it.daily_rate),
        weekly_rate: asNumber(it.weekly_rate),
        monthly_rate: asNumber(it.monthly_rate),
        rate_override: !!it.rate_override,
        line_notes: it.line_notes ?? "",
        query: cat ? `${cat.sku} — ${cat.name}` : "",
      };
    }),
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <p className="text-sm">
          <Link href={`/admin/orders/${id}`} className="brand-link">
            ← Back to {o.order_number}
          </Link>
        </p>
        <h2 className="font-display text-2xl font-semibold">
          Edit draft {o.order_number}
        </h2>
        <p className="text-sm text-muted-foreground">
          Update kit, quantities, and notes before confirm.
        </p>
      </div>
      <OrderBuilderForm
        clients={clientOpts}
        catalog={catalogOpts}
        defaultClientId={o.client_id}
        initial={initial}
      />
    </div>
  );
}

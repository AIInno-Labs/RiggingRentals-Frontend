import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { OrderBuilderForm } from "@/features/orders/components/order-builder-form";
import { isNoiseClient } from "@/features/catalog/is-noise-client";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const sp = await searchParams;
  const db = await rentalDb();
  const [{ data: clients }, { data: catalog }, { data: assets }] =
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

  const seenLabels = new Set<string>();
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
    .filter((c) => !isNoiseClient(c))
    .filter((c) => {
      if (seenLabels.has(c.id)) return false;
      seenLabels.add(c.id);
      const key = c.label.toLowerCase();
      if (seenLabels.has(key)) return false;
      seenLabels.add(key);
      return true;
    });

  const defaultClientId = sp.client?.trim() ?? "";
  // Guarantee convert→quote prefill even if label-dedupe dropped the row
  if (
    defaultClientId &&
    !clientOpts.some((c) => c.id === defaultClientId)
  ) {
    const raw = (clients ?? []).find(
      (c) => (c as { id: string }).id === defaultClientId,
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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold">New quote</h2>
        <p className="text-sm text-muted-foreground">
          Pick client and dates, add kit, save. Confirm from Orders to send to
          workshop.
        </p>
      </div>
      <OrderBuilderForm
        defaultClientId={defaultClientId}
        clients={clientOpts}
        catalog={(catalog ?? []).map((c) => {
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
        })}
      />
    </div>
  );
}

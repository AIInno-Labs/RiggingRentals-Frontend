import { Suspense } from "react";
import { rentalDb } from "@/lib/supabase/rental-db";
import { unwrapOne } from "@/lib/supabase/relations";
import { getCurrentProfile } from "@/features/rbac/get-current-profile";
import { canManageFleet } from "@/features/rbac/route-access";
import { parseDimensions } from "@/features/catalog/dimensions-spec";
import {
  FleetConsole,
  type FleetAssetRow,
  type FleetCatalogRow,
} from "@/features/catalog/components/fleet-console";

export default async function CatalogPage() {
  const profile = await getCurrentProfile();
  const manageFleet = profile ? canManageFleet(profile.role) : false;

  const db = await rentalDb();
  const [{ data: catalog }, { data: assets }] = await Promise.all([
    db
      .from("equipment_catalog")
      .select("*")
      .order("is_active", { ascending: false })
      .order("sku"),
    db
      .from("equipment_assets")
      .select(
        "id, serial_number, status, catalog_id, certificate_number, certificate_type, certificate_expires_at, next_inspection_at, certificate_file_path, certificate_file_name, equipment_catalog(sku, name, category)",
      )
      .order("serial_number"),
  ]);

  const catalogRows: FleetCatalogRow[] = (catalog ?? []).map((c) => {
    const row = c as FleetCatalogRow & { dimensions?: string | null };
    const dims = row.dimensions ?? "";
    const { weight, length } = parseDimensions(dims);
    return {
      id: row.id,
      sku: row.sku,
      category: row.category,
      name: row.name,
      dimensions: dims,
      weight,
      length,
      daily_rate: row.daily_rate,
      weekly_rate: row.weekly_rate,
      monthly_rate: row.monthly_rate,
      tracks_meter: row.tracks_meter,
      is_active: row.is_active,
    };
  });

  const catalogById = new Map(
    catalogRows.map((c) => [c.id, c] as const),
  );

  const assetRows: FleetAssetRow[] = (assets ?? []).map((a) => {
    const row = a as {
      id: string;
      catalog_id: string;
      serial_number: string;
      status: string;
      certificate_number: string | null;
      certificate_type: string | null;
      certificate_expires_at: string | null;
      next_inspection_at: string | null;
      certificate_file_path: string | null;
      certificate_file_name: string | null;
      equipment_catalog:
        | { sku: string; name: string; category: string | null }
        | { sku: string; name: string; category: string | null }[]
        | null;
    };
    const joined = unwrapOne(row.equipment_catalog);
    const fallback = catalogById.get(row.catalog_id);
    return {
      id: row.id,
      catalog_id: row.catalog_id,
      serial_number: row.serial_number,
      status: row.status,
      certificate_number: row.certificate_number ?? "",
      certificate_type: row.certificate_type ?? "LOLER",
      certificate_expires_at: row.certificate_expires_at,
      next_inspection_at: row.next_inspection_at,
      certificate_file_path: row.certificate_file_path ?? "",
      certificate_file_name: row.certificate_file_name ?? "",
      modelSku: joined?.sku ?? fallback?.sku ?? "",
      modelName: joined?.name ?? fallback?.name ?? "",
      modelCategory: joined?.category ?? fallback?.category ?? "",
    };
  });

  const catalogOptions = catalogRows.map((c) => ({
    id: c.id,
    label: `${c.sku} — ${c.name}`,
  }));

  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading fleet…</p>}>
      <FleetConsole
        manageFleet={manageFleet}
        catalog={catalogRows}
        assets={assetRows}
        catalogOptions={catalogOptions}
      />
    </Suspense>
  );
}

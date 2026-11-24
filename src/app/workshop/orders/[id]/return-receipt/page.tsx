import { notFound } from "next/navigation";
import Link from "next/link";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { catalogLabel } from "@/lib/supabase/relations";
import { PrintShell } from "@/features/documents/print-shell";
import {
  formatAuDate,
  formatAud,
} from "@/features/documents/company-profile";
import { formatDateTimeAu } from "@/lib/format-date";

export default async function ReturnReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await rentalDb();
  const { data: order } = await db
    .from("orders")
    .select("*, clients(company_name, contact_name)")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await db
    .from("order_items")
    .select("id, quantity, equipment_catalog(sku, name)")
    .eq("order_id", id);

  const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
  const { data: assignments } =
    itemIds.length > 0
      ? await db
          .from("order_asset_assignments")
          .select(
            "order_item_id, dispatch_meter, return_meter, returned_at, inspection_notes, damaged, damage_fee, dirty, cleaning_fee, missing, missing_fee, equipment_assets(serial_number)",
          )
          .in("order_item_id", itemIds)
      : { data: [] as unknown[] };

  const o = order as {
    order_number: string;
    start_at: string;
    end_at: string;
    off_rent_at: string | null;
    purchase_order: string;
    jobsite_name: string;
    delivery_address: string;
    status: string;
    clients:
      | { company_name: string; contact_name: string }
      | { company_name: string; contact_name: string }[]
      | null;
  };
  const client = Array.isArray(o.clients) ? o.clients[0] : o.clients;

  type AsgRow = {
    order_item_id: string;
    dispatch_meter: number | null;
    return_meter: number | null;
    returned_at: string | null;
    inspection_notes: string | null;
    damaged: boolean;
    damage_fee: number;
    dirty: boolean;
    cleaning_fee: number;
    missing: boolean;
    missing_fee: number;
    equipment_assets:
      | { serial_number: string }
      | { serial_number: string }[]
      | null;
  };

  const rows = (assignments ?? []) as AsgRow[];
  const allBack =
    rows.length > 0 && rows.every((a) => !!a.returned_at);
  const anyBack = rows.some((a) => !!a.returned_at);
  const partial = anyBack && !allBack;

  function conditionLabel(a: AsgRow): string {
    if (!a.returned_at) return "Still out";
    const parts: string[] = [];
    if (a.damaged) parts.push("Damaged");
    if (a.dirty) parts.push("Dirty");
    if (a.missing) parts.push("Missing");
    return parts.length > 0 ? parts.join(", ") : "OK";
  }

  function feeEstimate(a: AsgRow): string {
    if (!a.returned_at) return "—";
    let total = 0;
    total += asNumber(a.damage_fee);
    total += asNumber(a.cleaning_fee);
    total += asNumber(a.missing_fee);
    return total > 0 ? formatAud(total) : "None";
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-6">
      <div className="no-print mx-auto mb-4 flex max-w-[900px] flex-wrap items-center justify-between gap-2 px-6">
        <Link href="/workshop" className="text-sm brand-link">
          ← Workshop jobs
        </Link>
        <p className="text-xs text-muted-foreground">
          Proof of return — not a tax invoice. Finance issues the final hire
          invoice separately.
        </p>
      </div>
      <PrintShell
        title={o.order_number}
        docLabel="Return Receipt / Off-hire Docket"
      >
        {partial ? (
          <p className="mb-3 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium">
            Partial return — some RRP units still on hire.
          </p>
        ) : null}

        <div className="mb-4 grid gap-2 text-sm md:grid-cols-2">
          <div>
            <p>
              <strong>Returned by / Customer:</strong> {client?.company_name}
            </p>
            <p>
              <strong>Contact:</strong> {client?.contact_name || "—"}
            </p>
            <p>
              <strong>Jobsite:</strong> {o.jobsite_name || "—"}
            </p>
            <p>
              <strong>Address:</strong> {o.delivery_address || "—"}
            </p>
          </div>
          <div className="md:text-right">
            <p>
              <strong>Contract No:</strong> {o.order_number}
            </p>
            <p>
              <strong>Cust Job / PO:</strong> {o.purchase_order || "—"}
            </p>
            <p>
              <strong>Hire from:</strong> {formatAuDate(o.start_at)}
            </p>
            <p>
              <strong>Off-rent:</strong>{" "}
              {o.off_rent_at
                ? formatDateTimeAu(o.off_rent_at)
                : formatAuDate(o.end_at)}
            </p>
            <p>
              <strong>Status:</strong> {o.status}
            </p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>RRP Number</th>
              <th>Description</th>
              <th>Condition</th>
              <th>Fee est.</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).flatMap((raw) => {
              const it = raw as {
                id: string;
                quantity: number;
                equipment_catalog:
                  | { sku: string; name: string }
                  | { sku: string; name: string }[]
                  | null;
              };
              const asgs = rows.filter((a) => a.order_item_id === it.id);
              if (asgs.length === 0) {
                return [
                  <tr key={it.id}>
                    <td className="text-[#5c6570]">Unassigned</td>
                    <td>{catalogLabel(it.equipment_catalog)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>,
                ];
              }
              return asgs.map((a, idx) => {
                const asset = Array.isArray(a.equipment_assets)
                  ? a.equipment_assets[0]
                  : a.equipment_assets;
                return (
                  <tr key={`${it.id}-${idx}`}>
                    <td className="font-mono">
                      {asset?.serial_number ?? "—"}
                    </td>
                    <td>{catalogLabel(it.equipment_catalog)}</td>
                    <td>{conditionLabel(a)}</td>
                    <td>{feeEstimate(a)}</td>
                    <td className="max-w-[12rem] text-xs">
                      {a.inspection_notes?.trim() || "—"}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>

        <p className="mt-4 text-xs text-[#5c6570]">
          Fee estimates (if any) are subject to Finance review. Final hire
          charges appear on the tax invoice — not on this receipt.
        </p>

        <div className="mt-8 grid gap-6 text-sm md:grid-cols-2">
          <p>Yard / inspected by: ______________ Date: __________</p>
          <p>Customer acknowledgement: _________ Date: __________</p>
        </div>
      </PrintShell>
    </div>
  );
}

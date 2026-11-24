import { notFound } from "next/navigation";
import Link from "next/link";
import { rentalDb } from "@/lib/supabase/rental-db";
import { catalogLabel } from "@/lib/supabase/relations";
import { PrintShell } from "@/features/documents/print-shell";
import { parseDimensions } from "@/features/catalog/dimensions-spec";
import { PrintDocumentButton } from "@/features/documents/print-document-button";
import { formatAuDate } from "@/features/documents/company-profile";

export default async function PickingSlipPage({
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
    .select("id, quantity, line_notes, equipment_catalog(sku, name, dimensions)")
    .eq("order_id", id);

  const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
  const { data: assignments } =
    itemIds.length > 0
      ? await db
          .from("order_asset_assignments")
          .select(
            "order_item_id, dispatch_meter, equipment_assets(serial_number, certificate_number, certificate_expires_at)",
          )
          .in("order_item_id", itemIds)
      : { data: [] as unknown[] };

  const o = order as {
    order_number: string;
    start_at: string;
    end_at: string;
    purchase_order: string;
    jobsite_name: string;
    delivery_address: string;
    status: string;
    notes: string;
    quote_notes: string;
    clients:
      | { company_name: string; contact_name: string }
      | { company_name: string; contact_name: string }[]
      | null;
  };
  const client = Array.isArray(o.clients) ? o.clients[0] : o.clients;

  const slipNotes = [o.quote_notes?.trim(), o.notes?.trim()]
    .filter(Boolean)
    .join("\n\n");

  type Cat = {
    sku: string;
    name: string;
    dimensions?: string | null;
  };

  function specsOf(cat: Cat | Cat[] | null | undefined): { weight: string; length: string } {
    const c = Array.isArray(cat) ? cat[0] : cat;
    return parseDimensions(c?.dimensions);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-6">
      <div className="no-print mx-auto mb-4 max-w-[900px] px-6">
        <Link href="/workshop" className="text-sm brand-link">
          ← Workshop jobs
        </Link>
      </div>
      <PrintShell title={o.order_number} docLabel="Picking Slip">
        <div className="mb-4 grid gap-2 text-sm md:grid-cols-2">
          <div>
            <p>
              <strong>Deliver to:</strong> {client?.company_name}
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
              <strong>Hire to:</strong> {formatAuDate(o.end_at)}
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
              <th>Weight</th>
              <th>Length</th>
              <th>Qty</th>
              <th>Cert #</th>
              <th>Cert expiry</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).flatMap((raw) => {
              const it = raw as {
                id: string;
                quantity: number;
                line_notes: string;
                equipment_catalog: Cat | Cat[] | null;
              };
              const spec = specsOf(it.equipment_catalog);
              const asgs = (assignments ?? []).filter(
                (a) =>
                  (a as { order_item_id: string }).order_item_id === it.id,
              );
              if (asgs.length === 0) {
                return [
                  <tr key={it.id}>
                    <td className="text-[#5c6570]">Unassigned</td>
                    <td>{catalogLabel(it.equipment_catalog)}</td>
                    <td>{spec.weight || "—"}</td>
                    <td>{spec.length || "—"}</td>
                    <td>{it.quantity}</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>,
                ];
              }
              return asgs.map((a, idx) => {
                const row = a as {
                  dispatch_meter: number | null;
                  equipment_assets:
                    | {
                        serial_number: string;
                        certificate_number: string;
                        certificate_expires_at: string | null;
                      }
                    | {
                        serial_number: string;
                        certificate_number: string;
                        certificate_expires_at: string | null;
                      }[]
                    | null;
                };
                const asset = Array.isArray(row.equipment_assets)
                  ? row.equipment_assets[0]
                  : row.equipment_assets;
                return (
                  <tr key={`${it.id}-${idx}`}>
                    <td className="font-mono">{asset?.serial_number ?? "—"}</td>
                    <td>{catalogLabel(it.equipment_catalog)}</td>
                    <td>{spec.weight || "—"}</td>
                    <td>{spec.length || "—"}</td>
                    <td>1</td>
                    <td>{asset?.certificate_number || "—"}</td>
                    <td>{formatAuDate(asset?.certificate_expires_at)}</td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>

        <div className="mt-6 rounded border border-[#d4d4d8] p-3 text-sm">
          <p className="mb-1 font-semibold text-[#1a1f24]">Notes</p>
          <p className="whitespace-pre-wrap text-[#3f3f46]">
            {slipNotes || "—"}
          </p>
        </div>

        <div className="mt-8 grid gap-6 text-sm md:grid-cols-2">
          <p>Picked by: ______________________ Date: __________</p>
          <p>Received by: ____________________ Date: __________</p>
        </div>
      </PrintShell>
    </div>
  );
}

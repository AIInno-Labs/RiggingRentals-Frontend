import { notFound } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { rentalDb } from "@/lib/supabase/rental-db";
import { unwrapOne } from "@/lib/supabase/relations";
import {
  COMPANY,
  formatAuDate,
} from "@/features/documents/company-profile";
import { formatSpecDisplay } from "@/features/catalog/dimensions-spec";
import { PrintDocumentButton } from "@/features/documents/print-document-button";

/** PD + numeric part of order number (e.g. RO-209323 → PD209323). */
function docketNumberFromOrder(orderNumber: string): string {
  const digits = orderNumber.replace(/\D/g, "");
  return `PD${digits || "000000"}`;
}

export default async function DeliveryDocketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await rentalDb();
  const { data: order } = await db
    .from("orders")
    .select("*, clients(company_name, contact_name, phone, billing_address)")
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await db
    .from("order_items")
    .select(
      "id, quantity, line_notes, category, equipment_catalog(sku, name, dimensions, category)",
    )
    .eq("order_id", id);

  const o = order as {
    order_number: string;
    start_at: string;
    purchase_order: string;
    jobsite_name: string;
    delivery_address: string;
    notes: string;
    quote_notes: string;
    clients:
      | {
          company_name: string;
          contact_name: string;
          phone: string;
          billing_address: string;
        }
      | {
          company_name: string;
          contact_name: string;
          phone: string;
          billing_address: string;
        }[]
      | null;
  };
  const client = Array.isArray(o.clients) ? o.clients[0] : o.clients;
  const docketNo = docketNumberFromOrder(o.order_number);
  const docketDate = formatAuDate(new Date().toISOString());
  const deliverAddress =
    o.delivery_address?.trim() ||
    client?.billing_address?.trim() ||
    "—";
  const jobNotes = [o.quote_notes?.trim(), o.notes?.trim()]
    .filter(Boolean)
    .join(" · ");

  type Cat = {
    sku: string;
    name: string;
    dimensions?: string | null;
    category?: string | null;
  };

  const rows = (items ?? []).map((raw) => {
    const it = raw as {
      id: string;
      quantity: number;
      line_notes: string;
      category: string | null;
      equipment_catalog: Cat | Cat[] | null;
    };
    const cat = unwrapOne(it.equipment_catalog);
    const itemNo =
      (it.category || cat?.category || cat?.sku || "ITEM").toUpperCase();
    const specStr = formatSpecDisplay(cat?.dimensions);
    const descParts = [
      cat ? `${cat.name}${specStr ? ` — ${specStr}` : ""}` : null,
      cat?.sku ? `(${cat.sku})` : null,
    ].filter(Boolean);
    return {
      id: it.id,
      itemNo,
      description: descParts.join(" ") || "—",
      qty: it.quantity,
      notes: it.line_notes?.trim() || "",
    };
  });

  // Blank lines for handwriting (match paper docket breathing room).
  const blankRows = Math.max(0, 8 - rows.length);

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-6">
      <div className="no-print mx-auto mb-4 max-w-[900px] px-6">
        <Link href="/workshop" className="text-sm brand-link">
          ← Workshop jobs
        </Link>
      </div>

      <div className="print-doc mx-auto max-w-[900px] bg-[#fffef5] p-6 text-[#1a1f24] print:max-w-none print:bg-white print:p-0">
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .print-doc, .print-doc * { visibility: visible !important; }
            .print-doc { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
          .print-doc table { width: 100%; border-collapse: collapse; }
          .print-doc th, .print-doc td {
            border: 1px solid #3f3f46;
            padding: 8px 6px;
            font-size: 12px;
            vertical-align: top;
          }
          .print-doc th {
            background: #e4e4e7;
            text-align: left;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 11px;
          }
        `}</style>

        <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <BrandLogo variant="print" priority />
            <p className="mt-1 text-xs text-[#5c6570]">
              {COMPANY.website.replace(/^https?:\/\//, "")}
              <br />
              ABN {COMPANY.abn}
            </p>
          </div>
          <div className="text-right text-xs leading-relaxed">
            <p className="text-sm font-bold tracking-wide">PERTH</p>
            <p>{COMPANY.addressLine1}</p>
            <p>{COMPANY.addressLine2}</p>
            <p>Tel: {COMPANY.phone}</p>
          </div>
        </header>

        <div className="mb-4 grid grid-cols-1 gap-2 border border-[#111111] bg-[#f5d400] px-3 py-2 text-sm font-semibold text-[#111111] sm:grid-cols-3">
          <p>
            DELIVERY DOCKET No:{" "}
            <span className="font-mono font-bold">{docketNo}</span>
          </p>
          <p>
            Order No:{" "}
            <span className="font-mono font-bold">{o.order_number}</span>
          </p>
          <p className="sm:text-right">
            Date: <span className="font-bold">{docketDate}</span>
          </p>
        </div>

        <div className="mb-4 border border-[#111111] p-3 text-sm">
          <p className="mb-2 font-bold uppercase tracking-wide">Deliver To:</p>
          <p className="text-base font-semibold">{client?.company_name || "—"}</p>
          <p className="mt-1 whitespace-pre-wrap">{deliverAddress}</p>
          {o.jobsite_name ? (
            <p className="mt-1">
              <span className="text-[#5c6570]">Jobsite:</span> {o.jobsite_name}
            </p>
          ) : null}
          {o.purchase_order ? (
            <p className="mt-1">
              <span className="text-[#5c6570]">Cust Job / PO:</span>{" "}
              {o.purchase_order}
            </p>
          ) : null}
          <div className="mt-3 grid gap-2 border-t border-[#d4d4d8] pt-3 sm:grid-cols-2">
            <p>
              Site Contact Name:{" "}
              <span className="font-medium">
                {client?.contact_name || "____________________"}
              </span>
              {client?.phone ? (
                <span className="text-[#5c6570]"> · {client.phone}</span>
              ) : null}
            </p>
            <p>Deliver Via: ____________________</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: "18%" }}>Item No</th>
              <th>Description</th>
              <th style={{ width: "8%" }}>Qty</th>
              <th style={{ width: "6%" }}>✓</th>
              <th style={{ width: "10%" }}>Actual</th>
              <th style={{ width: "18%" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold uppercase">{r.itemNo}</td>
                <td>{r.description}</td>
                <td>{r.qty}</td>
                <td className="text-center">☐</td>
                <td />
                <td>{r.notes}</td>
              </tr>
            ))}
            {Array.from({ length: blankRows }).map((_, i) => (
              <tr key={`blank-${i}`}>
                <td className="h-9" />
                <td />
                <td />
                <td className="text-center text-[#a1a1aa]">☐</td>
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 min-h-[4.5rem] border border-dashed border-[#a1a1aa] p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase text-[#5c6570]">
            General notes
          </p>
          <p className="whitespace-pre-wrap">{jobNotes || " "}</p>
        </div>

        <div className="mt-8 grid gap-4 border-t-2 border-[#111111] pt-4 text-sm sm:grid-cols-4">
          <p>
            <span className="font-bold">DISPATCHED:</span>
            <br />
            ______________
          </p>
          <p>
            <span className="font-bold">TIME:</span>
            <br />
            ______________
          </p>
          <p>
            <span className="font-bold">NAME:</span>
            <br />
            ______________
          </p>
          <p>
            <span className="font-bold">SIGNATURE:</span>
            <br />
            ______________
          </p>
        </div>

        <div className="no-print mt-8 flex gap-2">
          <PrintDocumentButton />
        </div>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { catalogLabel } from "@/lib/supabase/relations";
import { parseDimensions } from "@/features/catalog/dimensions-spec";
import { PrintShell } from "@/features/documents/print-shell";
import {
  COMPANY,
  formatAud,
  formatAuDate,
} from "@/features/documents/company-profile";
import { HIRE_CLAUSES } from "@/features/documents/hire-terms";
import { calculateTieredRate, billableDaysBetween } from "@/features/pricing/calculate-rate";

export default async function QuoteDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await rentalDb();
  const { data: order } = await db
    .from("orders")
    .select(
      "*, clients(company_name, contact_name, email, billing_address)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const { data: items } = await db
    .from("order_items")
    .select(
      "*, equipment_catalog(sku, name, dimensions, daily_rate, weekly_rate, monthly_rate)",
    )
    .eq("order_id", id);

  const o = order as {
    order_number: string;
    start_at: string;
    end_at: string;
    created_at: string;
    quote_valid_until: string | null;
    quote_notes: string;
    purchase_order: string;
    jobsite_name: string;
    clients:
      | {
          company_name: string;
          contact_name: string;
          email: string;
          billing_address: string;
        }
      | {
          company_name: string;
          contact_name: string;
          email: string;
          billing_address: string;
        }[]
      | null;
  };
  const client = Array.isArray(o.clients) ? o.clients[0] : o.clients;
  const days = billableDaysBetween(o.start_at, o.end_at);
  const notes =
    (o.quote_notes ?? "").trim() ||
    COMPANY.defaultQuoteNotes.map((n, i) => `${i + 1}. ${n}`).join("\n");

  let est = 0;
  const rows = (items ?? []).map((raw) => {
    const it = raw as {
      quantity: number;
      daily_rate: number;
      weekly_rate: number;
      monthly_rate: number;
      equipment_catalog:
        | { sku: string; name: string; dimensions?: string | null }
        | { sku: string; name: string; dimensions?: string | null }[]
        | null;
    };
    const cat = Array.isArray(it.equipment_catalog)
      ? it.equipment_catalog[0]
      : it.equipment_catalog;
    const rate = calculateTieredRate({
      days,
      dailyRate: asNumber(it.daily_rate),
      weeklyRate: asNumber(it.weekly_rate),
      monthlyRate: asNumber(it.monthly_rate),
    });
    const line = rate.amount * it.quantity;
    est += line;
    const { weight, length } = parseDimensions(cat?.dimensions);
    return {
      label: catalogLabel(it.equipment_catalog),
      weight: weight || "—",
      length: length || "—",
      qty: it.quantity,
      unit: rate.amount,
      period: rate.mwd || "DAY",
      line,
    };
  });
  const gst = Math.round(est * COMPANY.gstRate * 100) / 100;

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-6">
      <div className="no-print mx-auto mb-4 max-w-[900px] px-6">
        <Link href={`/admin/orders/${id}`} className="text-sm brand-link">
          ← Back to order
        </Link>
      </div>
      <PrintShell
        title={o.order_number.replace(/^RO-/, "RRWA ")}
        docLabel="Quotation"
      >
        <div className="mb-4 grid gap-2 text-sm md:grid-cols-2">
          <div>
            <p>
              <strong>To:</strong> {client?.company_name}
            </p>
            <p>
              <strong>Attention:</strong> {client?.contact_name || "—"}
            </p>
            <p>{client?.billing_address}</p>
          </div>
          <div className="md:text-right">
            <p>
              <strong>Date:</strong> {formatAuDate(o.created_at)}
            </p>
            <p>
              <strong>Valid until:</strong>{" "}
              {formatAuDate(
                o.quote_valid_until ??
                  new Date(
                    Date.now() + COMPANY.quoteValidityDays * 86400000,
                  ).toISOString(),
              )}
            </p>
            <p>
              <strong>Hire:</strong> {formatAuDate(o.start_at)} →{" "}
              {formatAuDate(o.end_at)}
            </p>
            {o.purchase_order ? (
              <p>
                <strong>Client PO:</strong> {o.purchase_order}
              </p>
            ) : null}
            {o.jobsite_name ? (
              <p>
                <strong>Jobsite:</strong> {o.jobsite_name}
              </p>
            ) : null}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Sub Category</th>
              <th>Weight</th>
              <th>Length</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Period</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.label}</td>
                <td>{r.weight}</td>
                <td>{r.length}</td>
                <td>{r.qty}</td>
                <td>{formatAud(r.unit)}</td>
                <td>{r.period}</td>
                <td className="font-medium">{formatAud(r.line)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 ml-auto max-w-xs rounded border border-[#111111] bg-[#fafafa] p-3 text-sm">
          <p className="flex justify-between gap-4">
            <span>Hire (ex GST)</span>
            <strong>{formatAud(est)}</strong>
          </p>
          <p className="mt-1 flex justify-between gap-4">
            <span>GST {COMPANY.gstRate * 100}%</span>
            <strong>{formatAud(gst)}</strong>
          </p>
          <p className="mt-2 flex justify-between gap-4 border-t border-[#d4d4d8] pt-2 text-base font-bold">
            <span>Projected total</span>
            <span>{formatAud(est + gst)}</span>
          </p>
        </div>

        <div className="mt-6 whitespace-pre-wrap text-xs leading-relaxed text-[#5c6570]">
          <p className="mb-1 font-semibold text-[#1a1f24]">Notes</p>
          {notes}
        </div>

        <div className="mt-6 text-xs leading-relaxed text-[#5c6570]">
          <p className="mb-2 font-semibold text-[#1a1f24]">
            Conditions of Hire (summary) — RigRent QED.10
          </p>
          <ol className="list-decimal space-y-1 pl-4">
            {HIRE_CLAUSES.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <p className="mt-2">
            Full conditions available on request or via the hire agreement
            issued with confirmation.
          </p>
        </div>
      </PrintShell>
    </div>
  );
}

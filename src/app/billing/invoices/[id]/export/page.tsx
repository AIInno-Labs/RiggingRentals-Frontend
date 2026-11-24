import { notFound } from "next/navigation";
import Link from "next/link";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { PrintShell } from "@/features/documents/print-shell";
import {
  COMPANY,
  formatAud,
  formatAuDate,
} from "@/features/documents/company-profile";

export default async function InvoiceExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await rentalDb();
  const { data: inv } = await db
    .from("invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  const row = inv as {
    invoice_number: string;
    status: string;
    kind: string;
    order_id: string;
    period_start: string | null;
    period_end: string | null;
    subtotal: number;
    discount_amount: number;
    gst_amount: number;
    gst_rate: number;
    total: number;
    payment_due_at: string | null;
    created_at: string;
  };

  const { data: orderRow } = await db
    .from("orders")
    .select(
      "order_number, purchase_order, jobsite_name, client_id, clients(company_name, billing_address, contact_name)",
    )
    .eq("id", row.order_id)
    .maybeSingle();

  let order = orderRow as {
    order_number: string;
    purchase_order: string;
    jobsite_name: string;
    client_id: string;
    clients:
      | {
          company_name: string;
          billing_address: string;
          contact_name: string;
        }
      | {
          company_name: string;
          billing_address: string;
          contact_name: string;
        }[]
      | null;
  } | null;

  let client = order
    ? Array.isArray(order.clients)
      ? order.clients[0]
      : order.clients
    : null;

  if (!client && order?.client_id) {
    const { data: c } = await db
      .from("clients")
      .select("company_name, billing_address, contact_name")
      .eq("id", order.client_id)
      .maybeSingle();
    client = c as {
      company_name: string;
      billing_address: string;
      contact_name: string;
    } | null;
  }

  if (!order) {
    const { data: bare } = await db
      .from("orders")
      .select("order_number, purchase_order, jobsite_name, client_id")
      .eq("id", row.order_id)
      .maybeSingle();
    if (bare) {
      order = {
        ...(bare as {
          order_number: string;
          purchase_order: string;
          jobsite_name: string;
          client_id: string;
        }),
        clients: null,
      };
      if (!client && order.client_id) {
        const { data: c } = await db
          .from("clients")
          .select("company_name, billing_address, contact_name")
          .eq("id", order.client_id)
          .maybeSingle();
        client = c as {
          company_name: string;
          billing_address: string;
          contact_name: string;
        } | null;
      }
    }
  }

  const { data: lines } = await db
    .from("invoice_lines")
    .select("*")
    .eq("invoice_id", id)
    .order("sort_order");

  return (
    <div className="min-h-screen bg-[#f5f5f5] py-6">
      <div className="no-print mx-auto mb-4 max-w-[900px] px-6">
        <Link href="/billing" className="text-sm brand-link">
          ← Invoice queue
        </Link>
      </div>
      <PrintShell title={row.invoice_number} docLabel="Tax Invoice">
        <div className="mb-4 grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="font-semibold">Invoice to</p>
            <p>{client?.company_name || "—"}</p>
            <p>{client?.billing_address}</p>
            <p>{client?.contact_name}</p>
          </div>
          <div className="md:text-right">
            <p>
              <strong>Date:</strong> {formatAuDate(row.created_at)}
            </p>
            <p>
              <strong>Kind:</strong> {row.kind}
            </p>
            <p>
              <strong>Hire FROM–TO:</strong> {formatAuDate(row.period_start)} –{" "}
              {formatAuDate(row.period_end)}
            </p>
            <p>
              <strong>Contract No:</strong> {order?.order_number || "—"}
            </p>
            <p>
              <strong>Order / Cust Job:</strong> {order?.purchase_order || "—"}
            </p>
            <p>
              <strong>Jobsite:</strong> {order?.jobsite_name || "—"}
            </p>
            <p>
              <strong>Payment due:</strong> {formatAuDate(row.payment_due_at)}
            </p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {(lines ?? []).map((l) => {
              const line = l as {
                id: string;
                kind: string;
                description: string;
                quantity: number;
                unit_amount: number;
                line_total: number;
              };
              return (
                <tr key={line.id}>
                  <td>
                    <span className="text-xs uppercase text-[#5c6570]">
                      {line.kind}
                    </span>
                    <br />
                    {line.description}
                  </td>
                  <td>{asNumber(line.quantity)}</td>
                  <td>{formatAud(asNumber(line.unit_amount))}</td>
                  <td>{formatAud(asNumber(line.line_total))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 text-right text-sm">
          <p>Subtotal: {formatAud(asNumber(row.subtotal))}</p>
          {asNumber(row.discount_amount) > 0 ? (
            <p>Discount: −{formatAud(asNumber(row.discount_amount))}</p>
          ) : null}
          <p>
            GST {(asNumber(row.gst_rate) || COMPANY.gstRate) * 100}%:{" "}
            {formatAud(asNumber(row.gst_amount))}
          </p>
          <p className="text-lg font-bold">
            Invoice total: {formatAud(asNumber(row.total))}
          </p>
        </div>

        <div className="mt-8 border-t border-[#d4d4d8] pt-4 text-xs text-[#5c6570]">
          <p className="font-semibold text-[#1a1f24]">Direct deposit</p>
          <p>
            {COMPANY.bank.name} · BSB {COMPANY.bank.bsb} · A/C{" "}
            {COMPANY.bank.account}
          </p>
          <p>Remittance to: {COMPANY.accountsEmail}</p>
        </div>
      </PrintShell>
    </div>
  );
}

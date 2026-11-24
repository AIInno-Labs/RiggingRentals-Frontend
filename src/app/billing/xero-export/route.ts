import { rentalDb, asNumber } from "@/lib/supabase/rental-db";

function csvEscape(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

/** Xero-friendly sales invoice CSV for manual import. */
export async function GET() {
  const db = await rentalDb();
  const { data: invoices } = await db
    .from("invoices")
    .select(
      "invoice_number, status, total, gst_amount, payment_due_at, period_end, accounting_synced_at, orders(order_number, clients(company_name, email))",
    )
    .eq("status", "approved")
    .is("accounting_synced_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const header = [
    "ContactName",
    "EmailAddress",
    "InvoiceNumber",
    "InvoiceDate",
    "DueDate",
    "Description",
    "Quantity",
    "UnitAmount",
    "AccountCode",
    "TaxType",
  ];

  const lines = [header.join(",")];
  for (const row of invoices ?? []) {
    const inv = row as {
      invoice_number: string;
      total: number;
      gst_amount: number;
      payment_due_at: string | null;
      period_end: string | null;
      orders:
        | {
            order_number: string;
            clients:
              | { company_name: string; email: string }
              | { company_name: string; email: string }[]
              | null;
          }
        | {
            order_number: string;
            clients:
              | { company_name: string; email: string }
              | { company_name: string; email: string }[]
              | null;
          }[]
        | null;
    };
    const order = Array.isArray(inv.orders) ? inv.orders[0] : inv.orders;
    const client = order
      ? Array.isArray(order.clients)
        ? order.clients[0]
        : order.clients
      : null;
    const exGst = Math.max(
      0,
      asNumber(inv.total) - asNumber(inv.gst_amount),
    );
    const invoiceDate = (inv.period_end ?? new Date().toISOString()).slice(
      0,
      10,
    );
    const due = (inv.payment_due_at ?? invoiceDate).slice(0, 10);
    lines.push(
      [
        csvEscape(client?.company_name ?? "Unknown"),
        csvEscape(client?.email ?? ""),
        csvEscape(inv.invoice_number),
        csvEscape(invoiceDate),
        csvEscape(due),
        csvEscape(`Hire ${order?.order_number ?? ""}`),
        "1",
        csvEscape(exGst.toFixed(2)),
        "200",
        "GST on Income",
      ].join(","),
    );
  }

  const body = lines.join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="xero-invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

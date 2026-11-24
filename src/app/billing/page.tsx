import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/features/rbac/get-current-profile";
import { rentalDb, asNumber } from "@/lib/supabase/rental-db";
import { BillingDashboard } from "@/features/billing/components/billing-dashboard";
import { hasBillableQcFees } from "@/features/billing/billing-period";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; stage?: string; q?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const sp = await searchParams;
  const stageFilter = sp.stage?.trim() || sp.status?.trim() || undefined;

  const db = await rentalDb();
  const [{ data: returnedOrders }, { data: invoices }] = await Promise.all([
    db
      .from("orders")
      .select("id, order_number, client_id")
      .eq("status", "returned")
      .order("updated_at", { ascending: false }),
    db.from("invoices").select("*").order("created_at", { ascending: false }),
  ]);

  const invoiceOrderIds = [
    ...new Set(
      (invoices ?? [])
        .map((i) => (i as { order_id: string | null }).order_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const returnedOrderIds = (returnedOrders ?? []).map(
    (o) => (o as { id: string }).id,
  );
  const allOrderIds = [...new Set([...invoiceOrderIds, ...returnedOrderIds])];
  const invoiceIds = (invoices ?? []).map((i) => (i as { id: string }).id);

  const [{ data: orderRows }, { data: lines }] = await Promise.all([
    allOrderIds.length > 0
      ? db
          .from("orders")
          .select("id, order_number, client_id")
          .in("id", allOrderIds)
      : Promise.resolve({
          data: [] as { id: string; order_number: string; client_id: string }[],
        }),
    invoiceIds.length > 0
      ? db
          .from("invoice_lines")
          .select("*")
          .in("invoice_id", invoiceIds)
          .order("sort_order")
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const orderById = new Map(
    (orderRows ?? []).map((o) => {
      const row = o as {
        id: string;
        order_number: string;
        client_id: string;
      };
      return [row.id, row] as const;
    }),
  );

  const clientIds = [
    ...new Set(
      [...orderById.values()]
        .map((o) => o.client_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const { data: clientRows } =
    clientIds.length > 0
      ? await db.from("clients").select("id, company_name").in("id", clientIds)
      : { data: [] as { id: string; company_name: string }[] };
  const clientNameById = new Map(
    (clientRows ?? []).map((c) => {
      const row = c as { id: string; company_name: string };
      return [row.id, row.company_name] as const;
    }),
  );

  // Orders that already have a draft, or a final (draft/approved) — no create-draft needed
  const hasBlockingInvoice = new Set<string>();
  for (const inv of invoices ?? []) {
    const row = inv as {
      order_id: string;
      status: string;
      kind: string;
    };
    if (row.status === "void") continue;
    if (row.status === "draft") hasBlockingInvoice.add(row.order_id);
    if (
      row.kind === "final" &&
      (row.status === "draft" || row.status === "approved")
    ) {
      hasBlockingInvoice.add(row.order_id);
    }
  }

  // QC fees present on returned assignments (for filtering dead create-draft rows)
  const candidateReturnIds = (returnedOrders ?? [])
    .map((o) => (o as { id: string }).id)
    .filter((id) => !hasBlockingInvoice.has(id));

  const feeOrderIds = new Set<string>();
  if (candidateReturnIds.length > 0) {
    const { data: items } = await db
      .from("order_items")
      .select("id, order_id")
      .in("order_id", candidateReturnIds);
    const itemIds = (items ?? []).map((i) => (i as { id: string }).id);
    const itemOrder = new Map(
      (items ?? []).map((i) => {
        const row = i as { id: string; order_id: string };
        return [row.id, row.order_id] as const;
      }),
    );
    if (itemIds.length > 0) {
      const { data: asgs } = await db
        .from("order_asset_assignments")
        .select(
          "order_item_id, damaged, damage_fee, dirty, cleaning_fee, missing, missing_fee, meter_overage_fee",
        )
        .in("order_item_id", itemIds)
        .not("returned_at", "is", null);
      for (const raw of asgs ?? []) {
        const a = raw as {
          order_item_id: string;
          damaged: boolean;
          damage_fee: number;
          dirty: boolean;
          cleaning_fee: number;
          missing: boolean;
          missing_fee: number;
          meter_overage_fee: number;
        };
        if (hasBillableQcFees(a)) {
          const oid = itemOrder.get(a.order_item_id);
          if (oid) feeOrderIds.add(oid);
        }
      }
    }
  }

  const views = (invoices ?? []).map((inv) => {
    const row = inv as {
      id: string;
      invoice_number: string;
      status: string;
      kind?: string;
      period_start?: string | null;
      period_end?: string | null;
      payment_due_at?: string | null;
      subtotal: number;
      discount_amount: number;
      gst_amount?: number;
      deposit_applied: number;
      total: number;
      notes: string;
      order_id: string;
      sent_at?: string | null;
      paid_at?: string | null;
      paid_amount?: number;
      accounting_synced_at?: string | null;
    };
    const order = orderById.get(row.order_id);
    const accountName =
      (order?.client_id
        ? clientNameById.get(order.client_id)
        : undefined) ||
      (order?.order_number
        ? `Order ${order.order_number}`
        : "Customer unknown");
    return {
      id: row.id,
      invoice_number: row.invoice_number,
      status: row.status,
      kind: row.kind ?? "final",
      period_start: row.period_start ?? null,
      period_end: row.period_end ?? null,
      payment_due_at: row.payment_due_at ?? null,
      subtotal: asNumber(row.subtotal),
      discount_amount: asNumber(row.discount_amount),
      gst_amount: asNumber(row.gst_amount),
      deposit_applied: asNumber(row.deposit_applied),
      total: asNumber(row.total),
      notes: row.notes,
      order_id: row.order_id,
      order_number: order?.order_number ?? "",
      account_name: accountName,
      client_id: order?.client_id ?? "",
      sent_at: row.sent_at ?? null,
      paid_at: row.paid_at ?? null,
      paid_amount: asNumber(row.paid_amount),
      accounting_synced_at: row.accounting_synced_at ?? null,
      lines: (lines ?? [])
        .filter((l) => (l as { invoice_id: string }).invoice_id === row.id)
        .map((l) => {
          const line = l as {
            id: string;
            kind: string;
            description: string;
            quantity: number;
            unit_amount: number;
            line_total: number;
          };
          return {
            id: line.id,
            kind: line.kind,
            description: line.description,
            quantity: asNumber(line.quantity),
            unit_amount: asNumber(line.unit_amount),
            line_total: asNumber(line.line_total),
          };
        }),
    };
  });

  // Show returned hires that still need a bill: no draft/final yet.
  // Prefer those with QC fees; also keep others so Finance can try create
  // (compile soft-skips when nothing left to bill).
  const needsCompile = (returnedOrders ?? [])
    .map((o) => {
      const row = o as {
        id: string;
        order_number: string;
        client_id: string;
      };
      const mapped = orderById.get(row.id);
      const clientId = mapped?.client_id ?? row.client_id;
      return {
        id: row.id,
        order_number: mapped?.order_number ?? row.order_number,
        client_name: clientId
          ? clientNameById.get(clientId) ?? null
          : null,
        has_qc_fees: feeOrderIds.has(row.id),
      };
    })
    .filter((o) => !hasBlockingInvoice.has(o.id));

  return (
    <BillingDashboard
      returnedOrders={needsCompile}
      invoices={views}
      stageFilter={stageFilter}
      initialQuery={sp.q?.trim() ?? ""}
    />
  );
}

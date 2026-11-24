import Link from "next/link";
import { rentalDb } from "@/lib/supabase/rental-db";
import { OrderPipelineTable } from "@/features/orders/components/order-pipeline-table";
import type { OrderStatus } from "@/features/domain/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

function ordersHref(params: { status?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return qs ? `/admin/pipeline?${qs}` : "/admin/pipeline";
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; layout?: string }>;
}) {
  const sp = await searchParams;
  const focusStatus = sp.status?.trim() || undefined;
  const isQuotesMode = focusStatus === "draft";
  const q = sp.q?.trim() ?? "";
  const db = await rentalDb();

  const [{ data }, { count: leadCount }, { data: itemRows }] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, order_number, status, start_at, end_at, purchase_order, accepted_hire_agreement_at, hire_accepted_by, clients(company_name)",
      )
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
    db
      .from("leads")
      .select("id", { count: "exact", head: true })
      .neq("status", "lost")
      .neq("status", "won"),
    db
      .from("order_items")
      .select("order_id, quantity, equipment_catalog(name, sku)"),
  ]);

  const equipmentByOrder = new Map<string, string>();
  for (const row of itemRows ?? []) {
    const r = row as {
      order_id: string;
      quantity: number;
      equipment_catalog:
        | { name: string; sku: string }
        | { name: string; sku: string }[]
        | null;
    };
    if (equipmentByOrder.has(r.order_id)) continue;
    const cat = Array.isArray(r.equipment_catalog)
      ? r.equipment_catalog[0]
      : r.equipment_catalog;
    const label = cat
      ? `${cat.sku} ${cat.name}${r.quantity > 1 ? ` ×${r.quantity}` : ""}`
      : null;
    if (label) equipmentByOrder.set(r.order_id, label);
  }

  const orders = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      order_number: string;
      status: OrderStatus;
      start_at: string;
      end_at: string;
      purchase_order: string;
      accepted_hire_agreement_at: string | null;
      hire_accepted_by: string | null;
      clients: { company_name: string } | { company_name: string }[] | null;
    };
    const client = Array.isArray(r.clients) ? r.clients[0] ?? null : r.clients;
    return {
      id: r.id,
      order_number: r.order_number,
      status: r.status,
      start_at: r.start_at,
      end_at: r.end_at,
      purchase_order: r.purchase_order,
      accepted_hire_agreement_at: r.accepted_hire_agreement_at,
      hire_accepted_by: r.hire_accepted_by,
      clients: client,
      equipment_label: equipmentByOrder.get(r.id),
    };
  });

  const scopedOrders = focusStatus
    ? orders.filter((o) => o.status === focusStatus)
    : orders;
  const draftCount = orders.filter((o) => o.status === "draft").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">
            {isQuotesMode ? "Quotes" : "Orders"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isQuotesMode
              ? "Outstanding draft quotes. Confirm to send stock to the yard."
              : "Log enquiry, convert to quote, confirm, then send to the yard."}
          </p>
          {isQuotesMode ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Draft ({draftCount})
              {" · "}
              <Link href="/admin/pipeline" className="brand-link">
                View all orders
              </Link>
            </p>
          ) : focusStatus ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Highlighting{" "}
              <span className="font-semibold text-foreground">
                {focusStatus === "confirmed" || focusStatus === "pre_pick"
                  ? "handed to workshop"
                  : focusStatus.replaceAll("_", " ")}
              </span>
              {" · "}
              <Link
                href={ordersHref({ q: q || undefined })}
                className="brand-link"
              >
                Clear
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isQuotesMode ? (
            <span className="rounded-full border border-[#111111]/15 bg-white px-3 py-1.5 text-sm font-medium tabular-nums">
              Draft {draftCount}
            </span>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/leads">
                {(leadCount ?? 0) > 0
                  ? `Enquiries (${leadCount})`
                  : "Log enquiry"}
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-[#f5d400] text-[#111111] hover:bg-[#e6c600]"
            >
              <Link href="/admin/orders/new">New quote</Link>
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <OrderPipelineTable orders={scopedOrders} />
        </CardContent>
      </Card>
    </div>
  );
}

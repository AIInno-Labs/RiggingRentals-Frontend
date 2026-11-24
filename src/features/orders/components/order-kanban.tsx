"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatusAction } from "@/features/orders/actions";
import type { OrderStatus } from "@/features/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmHireDialog } from "@/features/orders/components/confirm-hire-dialog";
import { toast } from "sonner";
import Link from "next/link";
import { formatDateAu } from "@/lib/format-date";

type KanbanOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  start_at: string;
  end_at: string;
  purchase_order?: string;
  accepted_hire_agreement_at?: string | null;
  hire_accepted_by?: string | null;
  clients: { company_name: string } | null;
  equipment_label?: string;
};

type KanbanColumn = {
  id: string;
  statuses: OrderStatus[];
  title: string;
  hint: string;
};

/** Sales owns quote → confirm. Workshop/finance own later stages. */
const SALES_COLUMNS: KanbanColumn[] = [
  {
    id: "draft",
    statuses: ["draft"],
    title: "Quotes",
    hint: "Draft quotes awaiting PO / confirm",
  },
  {
    id: "workshop",
    statuses: ["confirmed", "pre_pick"],
    title: "Handed to workshop",
    hint: "Stock locked — yard is staging",
  },
  {
    id: "dispatched",
    statuses: ["dispatched"],
    title: "On rent",
    hint: "Live hire",
  },
  {
    id: "off_rent_pending",
    statuses: ["off_rent_pending"],
    title: "Off-rent",
    hint: "Awaiting return QC",
  },
  {
    id: "returned",
    statuses: ["returned"],
    title: "Returned",
    hint: "Finance compiling invoice",
  },
  {
    id: "invoiced",
    statuses: ["invoiced"],
    title: "Invoiced",
    hint: "Closed",
  },
];

const SALES_NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  draft: { to: "confirmed", label: "Confirm & send to workshop" },
};

type SortKey = "newest" | "oldest" | "company_az" | "company_za" | "start_soon";

export function OrderKanban({
  orders,
  mode = "sales",
  focusStatus,
  initialQuery = "",
}: {
  orders: KanbanOrder[];
  mode?: "sales" | "ops";
  focusStatus?: OrderStatus;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<string>(focusStatus ?? "all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [confirmOrder, setConfirmOrder] = useState<KanbanOrder | null>(null);

  const columns = SALES_COLUMNS;
  const nextMap =
    mode === "ops"
      ? {
          ...SALES_NEXT,
          confirmed: { to: "pre_pick" as const, label: "→ Pre-pick" },
        }
      : SALES_NEXT;

  const STAGE_GROUPS: Record<string, OrderStatus[]> = {
    group_sales: ["draft", "confirmed", "pre_pick"],
    group_ops: ["pre_pick", "dispatched", "off_rent_pending"],
    group_close: ["returned", "invoiced"],
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groupStatuses = STAGE_GROUPS[statusFilter];
    let list = orders.filter((o) => {
      if (statusFilter !== "all") {
        if (groupStatuses) {
          if (!groupStatuses.includes(o.status)) return false;
        } else if (o.status !== statusFilter) {
          return false;
        }
      }
      if (!q) return true;
      const company = o.clients?.company_name?.toLowerCase() ?? "";
      const po = o.purchase_order?.toLowerCase() ?? "";
      return (
        o.order_number.toLowerCase().includes(q) ||
        company.includes(q) ||
        po.includes(q)
      );
    });

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return a.start_at.localeCompare(b.start_at);
        case "company_az":
          return (a.clients?.company_name ?? "").localeCompare(
            b.clients?.company_name ?? "",
          );
        case "company_za":
          return (b.clients?.company_name ?? "").localeCompare(
            a.clients?.company_name ?? "",
          );
        case "start_soon":
          return a.start_at.localeCompare(b.start_at);
        case "newest":
        default:
          return b.start_at.localeCompare(a.start_at);
      }
    });
    return list;
  }, [orders, query, statusFilter, sortKey]);

  function move(orderId: string, status: OrderStatus) {
    setPendingOrderId(orderId);
    start(async () => {
      try {
        const result = await updateOrderStatusAction({
          order_id: orderId,
          status,
        });
        if (!result.success) {
          if (
            status === "confirmed" &&
            result.error.code === "ACCEPTANCE_REQUIRED"
          ) {
            const order = orders.find((o) => o.id === orderId) ?? null;
            setConfirmOrder(order);
            toast.message("Record who accepted the hire T&Cs, then confirm");
            return;
          }
          toast.error(result.error.message);
        } else
          toast.success(
            status === "confirmed"
              ? "Confirmed — sent to workshop"
              : `Moved to ${status}`,
          );
      } finally {
        setPendingOrderId(null);
      }
    });
  }

  function requestConfirm(order: KanbanOrder) {
    setConfirmOrder(order);
  }

  const visibleColumns =
    statusFilter === "all"
      ? columns
      : STAGE_GROUPS[statusFilter]
        ? columns.filter((c) =>
            c.statuses.some((s) => STAGE_GROUPS[statusFilter]!.includes(s)),
          )
        : columns.filter(
            (c) =>
              c.id === statusFilter ||
              c.statuses.includes(statusFilter as OrderStatus),
          );

  return (
    <div className="space-y-3">
      <div className="steel-panel flex flex-wrap items-end gap-3 rounded-2xl p-3">
        <div className="min-w-[200px] flex-1 grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Company, order #, or PO…"
            className="h-9 bg-white/70"
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Filter stage
          </label>
          <select
            className="h-9 rounded-lg border border-input bg-white/70 px-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All stages</option>
            <option value="group_sales">Sales (Quotes + workshop)</option>
            <option value="group_ops">Active hire</option>
            <option value="group_close">Returned + Invoiced</option>
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Sort
          </label>
          <select
            className="h-9 rounded-lg border border-input bg-white/70 px-2 text-sm"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="newest">Start date · newest</option>
            <option value="oldest">Start date · oldest</option>
            <option value="start_soon">Start date · soonest</option>
            <option value="company_az">Company A–Z</option>
            <option value="company_za">Company Z–A</option>
          </select>
        </div>
        <p className="pb-1 text-xs text-muted-foreground">
          Showing {filtered.length} of {orders.length}
          {query || statusFilter !== "all" ? (
            <>
              {" · "}
              <button
                type="button"
                className="brand-link"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                  setSortKey("newest");
                }}
              >
                Clear
              </button>
            </>
          ) : null}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d4d4d8] px-4 py-8 text-center text-sm text-muted-foreground">
          No quotes/orders match. Open{" "}
          <Link href="/admin/leads" className="brand-link">
            Enquiries
          </Link>
          {" "}
          to log a lead, then convert → New quote onto this board.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {visibleColumns.map((col) => {
            const cards = filtered.filter((o) => col.statuses.includes(o.status));
            const focused =
              (focusStatus != null && col.statuses.includes(focusStatus)) ||
              statusFilter === col.id ||
              (focusStatus == null &&
                col.statuses.includes(statusFilter as OrderStatus));
            return (
              <section
                key={col.id}
                id={`pipeline-${col.id}`}
                className={`min-w-[240px] flex-1 rounded-lg border p-2 ${
              focused
                ? "border-[#111111] bg-[#f5d400]/20 ring-2 ring-[#f5d400]"
                : "border-border bg-muted/30"
                }`}
              >
                <header className="mb-2 space-y-0.5 px-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{col.title}</h2>
                    <Badge variant="outline">{cards.length}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{col.hint}</p>
                </header>
                <div className="flex flex-col gap-2">
                  {cards.length === 0 ? (
                    <p className="rounded-md border border-dashed border-[#d4d4d8] bg-white/60 px-2 py-6 text-center text-xs text-muted-foreground">
                      Empty — nothing in {col.title.toLowerCase()}
                    </p>
                  ) : (
                    cards.map((order) => {
                      const next = nextMap[order.status];
                      return (
                        <article
                          key={order.id}
                          className="rounded-md border border-border bg-background p-3 shadow-sm"
                        >
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-medium hover:underline"
                          >
                            {order.order_number}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {order.clients?.company_name ?? "Client"}
                          </p>
                          {order.equipment_label ? (
                            <p className="mt-1 inline-flex max-w-full truncate rounded-full bg-[#f4f4f5] px-2 py-0.5 text-[11px] font-medium text-foreground">
                              {order.equipment_label}
                            </p>
                          ) : null}
                          {order.purchase_order ? (
                            <p className="mt-0.5 font-mono text-[11px] text-[#111111]">
                              PO {order.purchase_order}
                            </p>
                          ) : order.status === "draft" ? (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              No PO yet
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateAu(order.start_at)} →{" "}
                            {formatDateAu(order.end_at)}
                          </p>
                          {next ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 h-10 w-full"
                              disabled={pendingOrderId === order.id}
                              aria-busy={pendingOrderId === order.id}
                              onClick={() =>
                                next.to === "confirmed"
                                  ? requestConfirm(order)
                                  : move(order.id, next.to)
                              }
                            >
                              {pendingOrderId === order.id
                                ? "Updating…"
                                : next.label}
                            </Button>
                          ) : null}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ConfirmHireDialog
        open={confirmOrder != null}
        onOpenChange={(open) => {
          if (!open) setConfirmOrder(null);
        }}
        orderId={confirmOrder?.id ?? ""}
        orderNumber={confirmOrder?.order_number ?? ""}
        acceptedAt={confirmOrder?.accepted_hire_agreement_at}
        acceptedBy={confirmOrder?.hire_accepted_by}
        onConfirmed={() => {
          setConfirmOrder(null);
          router.refresh();
        }}
      />
    </div>
  );
}

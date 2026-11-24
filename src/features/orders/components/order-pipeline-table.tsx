"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/features/domain/types";
import { ORDER_STATUSES } from "@/features/domain/types";
import { formatDateAu } from "@/lib/format-date";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type PipelineTableOrder = {
  id: string;
  order_number: string;
  status: OrderStatus;
  start_at: string;
  end_at: string;
  clients: { company_name: string } | null;
};

type SortKey = "start_asc" | "start_desc" | "end_asc" | "end_desc";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  ...ORDER_STATUSES.filter((s) => s !== "cancelled").map((s) => ({
    value: s,
    label: s.replaceAll("_", " "),
  })),
];

export function OrderPipelineTable({
  orders,
}: {
  orders: PipelineTableOrder[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("start_desc");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      const company = o.clients?.company_name?.toLowerCase() ?? "";
      const orderNo = o.order_number.toLowerCase();
      return company.includes(q) || orderNo.includes(q);
    });

    list = [...list].sort((a, b) => {
      const aStart = new Date(a.start_at).getTime();
      const bStart = new Date(b.start_at).getTime();
      const aEnd = new Date(a.end_at).getTime();
      const bEnd = new Date(b.end_at).getTime();
      switch (sortKey) {
        case "start_asc":
          return aStart - bStart;
        case "start_desc":
          return bStart - aStart;
        case "end_asc":
          return aEnd - bEnd;
        case "end_desc":
          return bEnd - aEnd;
        default:
          return 0;
      }
    });

    return list;
  }, [orders, query, statusFilter, sortKey]);

  function toggleSort(field: "start" | "end") {
    setSortKey((prev) => {
      if (field === "start") {
        return prev === "start_desc" ? "start_asc" : "start_desc";
      }
      return prev === "end_desc" ? "end_asc" : "end_desc";
    });
  }

  function sortMark(field: "start" | "end") {
    if (field === "start" && sortKey.startsWith("start")) {
      return sortKey === "start_asc" ? " ↑" : " ↓";
    }
    if (field === "end" && sortKey.startsWith("end")) {
      return sortKey === "end_asc" ? " ↑" : " ↓";
    }
    return "";
  }

  function openOrder(id: string) {
    router.push(`/admin/orders/${id}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Search clients
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Client name or order #…"
            className="h-9"
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <select
            className="h-9 rounded-lg border border-input bg-white px-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <p className="pb-2 text-xs text-muted-foreground tabular-nums">
          Showing {visible.length} of {orders.length}
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order #</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>
              <button
                type="button"
                className="font-medium hover:text-foreground"
                onClick={() => toggleSort("start")}
              >
                Start{sortMark("start")}
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                className="font-medium hover:text-foreground"
                onClick={() => toggleSort("end")}
              >
                End{sortMark("end")}
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No orders match.
              </TableCell>
            </TableRow>
          ) : (
            visible.map((row) => (
              <TableRow
                key={row.id}
                role="link"
                tabIndex={0}
                className="cursor-pointer transition-colors hover:bg-[#fafafa]"
                onClick={() => openOrder(row.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openOrder(row.id);
                  }
                }}
              >
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/orders/${row.id}`}
                    className="brand-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {row.order_number}
                  </Link>
                </TableCell>
                <TableCell>{row.clients?.company_name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {row.status.replaceAll("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateAu(row.start_at)}</TableCell>
                <TableCell>{formatDateAu(row.end_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

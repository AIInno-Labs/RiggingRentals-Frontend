"use client";

import { useMemo, useState, useTransition } from "react";
import { updateWorkOrderAction } from "@/features/operations/actions";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/status-pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { formatDateAu } from "@/lib/format-date";

export type WorkOrderRow = {
  id: string;
  title: string;
  description?: string;
  work_type: string;
  status: string;
  due_at: string | null;
  estimated_hours: number;
  parts_cost: number;
  labor_cost: number;
  serial_number: string;
  catalog_name: string;
};

const FILTERS = [
  { id: "active", label: "Active" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "waiting_parts", label: "Waiting parts" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
] as const;

export function MaintenanceTable({ rows }: { rows: WorkOrderRow[] }) {
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "active") {
      return rows.filter((r) =>
        ["open", "in_progress", "waiting_parts"].includes(r.status),
      );
    }
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  function setStatus(id: string, status: WorkOrderRow["status"]) {
    start(async () => {
      const result = await updateWorkOrderAction({ id, status });
      if (!result.success) toast.error(result.error.message);
      else toast.success(`Work order → ${status}`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === f.id
                ? "bg-[#111111] text-[#f5d400]"
                : "bg-[#f4f4f5] text-muted-foreground hover:bg-[#e4e4e7]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Work order</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Parts</TableHead>
            <TableHead className="text-right">Labor</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-sm text-muted-foreground">
                No work orders in this filter.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((row) => {
              const total = Math.round((row.parts_cost + row.labor_cost) * 100) / 100;
              return (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="font-mono text-sm">{row.serial_number}</p>
                  <p className="text-xs text-muted-foreground">{row.catalog_name}</p>
                </TableCell>
                <TableCell>
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Est {row.estimated_hours}h
                  </p>
                </TableCell>
                <TableCell>{row.work_type}</TableCell>
                <TableCell className="text-sm">
                  {row.due_at ? formatDateAu(row.due_at) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  ${row.parts_cost.toFixed(0)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  ${row.labor_cost.toFixed(0)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm font-medium">
                  ${total.toFixed(0)}
                </TableCell>
                <TableCell>
                  <StatusPill status={row.status} />
                </TableCell>
                <TableCell className="space-x-1">
                  {row.status !== "in_progress" && row.status !== "completed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setStatus(row.id, "in_progress")}
                    >
                      Start
                    </Button>
                  ) : null}
                  {row.status !== "completed" ? (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => setStatus(row.id, "completed")}
                    >
                      Complete
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/status-pill";
import { formatDateAu } from "@/lib/format-date";

export type AvailabilityBooking = {
  order_id: string;
  order_number: string;
  company_name: string;
  status: string;
  quantity: number;
  start_at: string;
  end_at: string;
};

export type AvailabilityHold = {
  id: string;
  title: string;
  status: string;
  serial_number: string;
  due_at: string | null;
};

export type AvailabilityCell = { day: string; free: number; physical: number };

export type AvailabilityRow = {
  id: string;
  sku: string;
  name: string;
  family: string;
  cells: AvailabilityCell[];
  bookings: AvailabilityBooking[];
  holds: AvailabilityHold[];
};

function tone(free: number, physical: number) {
  if (physical === 0) return "bg-[#f4f4f5] text-muted-foreground";
  if (free === 0) return "bg-[#b42318]/15 text-[#8f1d14]";
  if (free / physical <= 0.34 || free === 1)
    return "bg-amber-500/20 text-amber-900";
  return "bg-emerald-500/15 text-emerald-800";
}

function overlapsDay(startAt: string, endAt: string, day: string) {
  const dayStart = new Date(`${day}T00:00:00`);
  const dayEnd = new Date(`${day}T23:59:59.999`);
  return new Date(startAt) <= dayEnd && dayStart <= new Date(endAt);
}

function formatDay(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

type Selection = { row: AvailabilityRow; day: string };

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function openDatePicker(el: HTMLInputElement) {
  try {
    el.showPicker?.();
  } catch {
    /* already open */
  }
}

function ZeroStockSummary({
  count,
  days,
  alerts,
}: {
  count: number;
  days: number;
  alerts: { id: string; label: string; count: number; from: string; to: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 rounded-xl border border-[#b42318]/30 bg-[#b42318]/10 px-3 py-2 text-sm text-[#8f1d14]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left font-semibold"
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          Zero stock ({count} model{count === 1 ? "" : "s"})
        </span>
        <span className="text-xs font-medium">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <ul className="mt-1.5 space-y-1 text-xs">
          {alerts.slice(0, 8).map((a) => (
            <li key={a.id}>
              <span className="font-medium">{a.label}</span>
              {" — "}
              sold out {a.count}/{days} days
              {a.from === a.to
                ? ` (${formatDay(a.from)})`
                : ` (${formatDay(a.from)} → ${formatDay(a.to)})`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AvailabilityGrid({
  days,
  from,
  to,
  rows,
}: {
  days: string[];
  from: string;
  to: string;
  rows: AvailabilityRow[];
}) {
  const router = useRouter();
  const families = useMemo(() => {
    const set = new Set(rows.map((r) => r.family));
    return ["All", ...[...set].sort()];
  }, [rows]);
  const [family, setFamily] = useState("All");
  const [showFamilies, setShowFamilies] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    setDayFilter("all");
    setSelection(null);
  }, [from, to]);

  function applyWindow(nextFrom: string, nextTo: string) {
    let a = nextFrom;
    let b = nextTo;
    if (b < a) b = a;
    router.push(`/admin/availability?from=${a}&to=${b}`);
  }

  const filtered = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (family !== "All" && r.family !== family) return false;
      if (
        q &&
        !r.sku.toLowerCase().includes(q) &&
        !r.name.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (dayFilter !== "all") {
        const cell = r.cells.find((c) => c.day === dayFilter);
        if (!cell) return false;
      }
      return true;
    });
  }, [rows, family, productQuery, dayFilter]);

  const visibleDays =
    dayFilter === "all" ? days : days.filter((d) => d === dayFilter);

  const zeroStockAlerts = useMemo(() => {
    return rows
      .map((r) => {
        const zeroDays = r.cells.filter((c) => c.physical > 0 && c.free === 0);
        if (zeroDays.length === 0) return null;
        const first = zeroDays[0]!.day;
        const last = zeroDays[zeroDays.length - 1]!.day;
        return {
          id: r.id,
          label: `${r.sku} — ${r.name}`,
          count: zeroDays.length,
          from: first,
          to: last,
        };
      })
      .filter(Boolean) as {
      id: string;
      label: string;
      count: number;
      from: string;
      to: string;
    }[];
  }, [rows]);

  const drawerBookings = selection
    ? selection.row.bookings.filter((b) =>
        overlapsDay(b.start_at, b.end_at, selection.day),
      )
    : [];
  const drawerCell = selection
    ? selection.row.cells.find((c) => c.day === selection.day)
    : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
          <CardDescription>
            Set the hire window (same dates as a quote). Includes draft quotes
            that already hold stock. Click a cell for who is using it.
          </CardDescription>
          {zeroStockAlerts.length > 0 ? (
            <ZeroStockSummary
              count={zeroStockAlerts.length}
              days={days.length}
              alerts={zeroStockAlerts}
            />
          ) : null}
          <div className="flex flex-wrap items-end gap-2 pt-2">
            <div className="grid gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                From
              </label>
              <input
                type="date"
                value={from}
                onClick={(e) => openDatePicker(e.currentTarget)}
                onChange={(e) => applyWindow(e.target.value, to)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                To
              </label>
              <input
                type="date"
                value={to}
                min={from}
                onClick={(e) => openDatePicker(e.currentTarget)}
                onChange={(e) => applyWindow(from, e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-1 pb-0.5">
              <button
                type="button"
                className="h-8 rounded-lg border border-input px-2 text-xs hover:bg-[#f4f4f5]"
                onClick={() => {
                  const t = todayIso();
                  applyWindow(t, addDays(t, 13));
                }}
              >
                Next 14 days
              </button>
              <button
                type="button"
                className="h-8 rounded-lg border border-input px-2 text-xs hover:bg-[#f4f4f5]"
                onClick={() => {
                  const t = todayIso();
                  applyWindow(t, addDays(t, 29));
                }}
              >
                Next 30 days
              </button>
            </div>
            <div className="grid min-w-[12rem] flex-1 gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Sub Category
              </label>
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Search SKU or name…"
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Focus day
              </label>
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="all">Whole window</option>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {formatDay(d)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="h-8 self-end rounded-lg border border-input px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setShowFamilies((v) => !v)}
            >
              {showFamilies || family !== "All" ? "Hide types" : "Types"}
            </button>
          </div>
          {showFamilies || family !== "All" ? (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {families.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFamily(f)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  family === f
                    ? "bg-[#111111] text-[#f5d400]"
                    : "bg-[#f4f4f5] text-muted-foreground hover:bg-[#e4e4e7]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          ) : null}
        </CardHeader>
        <CardContent className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-background p-2 text-left shadow-[1px_0_0_#e4e4e7]">
                  Model
                </th>
                {visibleDays.map((d) => (
                  <th
                    key={d}
                    className="sticky top-0 z-10 bg-background p-2 font-medium"
                  >
                    {formatDay(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((cat) => (
                <tr key={cat.id} className="border-t">
                  <td className="sticky left-0 z-10 bg-background p-2 shadow-[1px_0_0_#e4e4e7]">
                    <p className="font-medium">{cat.sku}</p>
                    <p className="text-muted-foreground">{cat.name}</p>
                  </td>
                  {cat.cells
                    .filter((cell) => visibleDays.includes(cell.day))
                    .map((cell) => (
                    <td key={cell.day} className="p-1 text-center">
                      <button
                        type="button"
                        title={`Inspect ${cat.sku} on ${formatDay(cell.day)}`}
                        onClick={() => setSelection({ row: cat, day: cell.day })}
                        className="inline-flex"
                      >
                        <Badge
                          className={`${tone(cell.free, cell.physical)} cursor-pointer transition-opacity hover:opacity-80`}
                          variant="secondary"
                        >
                          {cell.free}/{cell.physical}
                        </Badge>
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selection ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="avail-drawer-title"
          onClick={() => setSelection(null)}
        >
          <aside
            className="flex h-full w-full max-w-md flex-col border-l border-border bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="border-b border-border px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {formatDay(selection.day)}
                  </p>
                  <h3
                    id="avail-drawer-title"
                    className="font-display text-lg font-semibold"
                  >
                    {selection.row.sku}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selection.row.name}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setSelection(null)}
                >
                  Close
                </button>
              </div>
              {drawerCell ? (
                <p className="mt-2 text-sm">
                  <span className="font-semibold tabular-nums">
                    {drawerCell.free}/{drawerCell.physical}
                  </span>{" "}
                  free
                </p>
              ) : null}
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Reservations / hires
                </h4>
                {drawerBookings.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#d4d4d8] px-3 py-4 text-sm text-muted-foreground">
                    No overlapping bookings this day.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {drawerBookings.map((b) => (
                      <li
                        key={`${b.order_id}-${b.start_at}`}
                        className="rounded-xl border border-[#e4e4e7] px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/admin/orders/${b.order_id}`}
                            className="font-medium brand-link"
                          >
                            {b.order_number}
                          </Link>
                          <StatusPill status={b.status} />
                        </div>
                        <p className="mt-0.5 text-sm">{b.company_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty {b.quantity} · {formatDateAu(b.start_at)} →{" "}
                          {formatDateAu(b.end_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Shop holds
                </h4>
                {selection.row.holds.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#d4d4d8] px-3 py-4 text-sm text-muted-foreground">
                    No units in maintenance or inspection.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {selection.row.holds.map((h) => (
                      <li
                        key={h.id}
                        className="rounded-xl border border-[#e4e4e7] px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-mono text-sm">{h.serial_number}</p>
                          <StatusPill status={h.status} />
                        </div>
                        <p className="mt-0.5 text-sm">{h.title}</p>
                        {h.due_at ? (
                          <p className="text-xs text-muted-foreground">
                            Due {formatDateAu(h.due_at)}
                          </p>
                        ) : null}
                        {!h.id.startsWith("asset-") ? (
                          <Link
                            href="/admin/maintenance"
                            className="mt-1 inline-block text-xs brand-link"
                          >
                            Open maintenance
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/catalog?status=${encodeURIComponent(h.status)}`}
                            className="mt-1 inline-block text-xs brand-link"
                          >
                            View in catalog
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

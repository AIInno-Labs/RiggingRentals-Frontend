"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  markReadyForDispatchAction,
  dispatchOrderAction,
  revertDispatchAction,
  requestOffRentAction,
  returnAssignmentAction,
  completeTurnaroundAction,
} from "@/features/workshop/actions";
import { updateLineNotesAction } from "@/features/orders/actions";
import { EvidenceUploader } from "@/features/workshop/components/evidence-uploader";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateAu } from "@/lib/format-date";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type WorkshopOrder = {
  id: string;
  order_number: string;
  status: string;
  start_at: string;
  end_at: string;
  clients: { company_name: string } | null;
  items: {
    id: string;
    catalog_id: string;
    quantity: number;
    catalog_name: string;
    line_notes: string;
  }[];
  assignments: {
    id: string;
    order_item_id: string;
    asset_id: string;
    serial_number: string;
    dispatch_meter: number | null;
    return_meter: number | null;
    returned_at: string | null;
  }[];
};

export type AssetOption = {
  id: string;
  catalog_id: string;
  serial_number: string;
  meter_hours: number;
  status: string;
  certificate_number?: string;
  certificate_type?: string;
  certificate_expires_at?: string | null;
  catalog_label?: string;
  last_order_number?: string | null;
  last_client_name?: string | null;
};

type SortKey = "start_asc" | "start_desc" | "end_asc" | "end_desc";

/**
 * Clean table format matching the Orders route (OrderPipelineTable) design exactly.
 * Every job item appears directly as a row. Clicking a row opens the order details page.
 */
export function WorkshopJobsTable({
  orders,
  emptyHint = "No jobs match.",
}: {
  orders: WorkshopOrder[];
  assets?: AssetOption[];
  canRevertDispatch?: boolean;
  emptyHint?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("start_desc");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = orders.filter((o) => {
      if (!q) return true;
      const company = o.clients?.company_name?.toLowerCase() ?? "";
      const orderNo = o.order_number.toLowerCase();
      const itemHit = o.items.some((i) =>
        i.catalog_name.toLowerCase().includes(q),
      );
      const serialHit = o.assignments.some((a) =>
        a.serial_number.toLowerCase().includes(q),
      );
      return company.includes(q) || orderNo.includes(q) || itemHit || serialHit;
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
  }, [orders, query, sortKey]);

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
    router.push(`/workshop/orders/${id}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[200px] flex-1 grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Search jobs
          </label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Client name, order #, or equipment…"
            className="h-9"
          />
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
            <TableHead>Equipment</TableHead>
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
                colSpan={6}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {emptyHint}
              </TableCell>
            </TableRow>
          ) : (
            visible.map((order) => {
              const equipmentSummary =
                order.items
                  .map((i) => `${i.catalog_name} ×${i.quantity}`)
                  .join(", ") || "—";

              return (
                <TableRow
                  key={order.id}
                  role="link"
                  tabIndex={0}
                  className="cursor-pointer transition-colors hover:bg-[#fafafa]"
                  onClick={() => openOrder(order.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openOrder(order.id);
                    }
                  }}
                >
                  <TableCell className="font-medium font-mono">
                    <Link
                      href={`/workshop/orders/${order.id}`}
                      className="brand-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {order.order_number}
                    </Link>
                  </TableCell>
                  <TableCell>{order.clients?.company_name ?? "—"}</TableCell>
                  <TableCell
                    className="max-w-[240px] truncate text-xs text-muted-foreground"
                    title={equipmentSummary}
                  >
                    {equipmentSummary}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {order.status.replaceAll("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateAu(order.start_at)}</TableCell>
                  <TableCell>{formatDateAu(order.end_at)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

type PickState = {
  asset_id: string;
  dispatch_meter: number;
  pack_weight_kg: number;
  cert_checked: boolean;
};

function emptyPick(): PickState {
  return {
    asset_id: "",
    dispatch_meter: 0,
    pack_weight_kg: 0,
    cert_checked: false,
  };
}

function initialPicks(order: WorkshopOrder): Record<string, PickState[]> {
  const out: Record<string, PickState[]> = {};
  for (const item of order.items) {
    const asgs = order.assignments.filter((a) => a.order_item_id === item.id);
    const slots: PickState[] = [];
    for (let i = 0; i < Math.max(1, item.quantity); i++) {
      const a = asgs[i];
      if (a) {
        slots.push({
          asset_id: a.asset_id,
          dispatch_meter: a.dispatch_meter ?? 0,
          pack_weight_kg: 0,
          cert_checked: true,
        });
      } else {
        slots.push(emptyPick());
      }
    }
    out[item.id] = slots;
  }
  return out;
}

/**
 * Full workshop operational card component.
 * Rendered on the Order Details page to provide all picking, cert checking,
 * dispatching, off-hire, and return QC functionality.
 */
export function WorkshopJobCard({
  order,
  assets,
  canRevertDispatch = false,
}: {
  order: WorkshopOrder;
  assets: AssetOption[];
  canRevertDispatch?: boolean;
}) {
  const [pending, start] = useTransition();
  const [picks, setPicks] = useState<Record<string, PickState[]>>(() =>
    initialPicks(order),
  );

  const availableByCatalog = useMemo(() => {
    const map = new Map<string, AssetOption[]>();
    const today = new Date().toISOString().slice(0, 10);
    const assignedIds = new Set(
      order.assignments.map((a) => a.asset_id).filter(Boolean),
    );
    for (const a of assets) {
      const usable =
        a.status === "available" ||
        a.status === "reserved" ||
        assignedIds.has(a.id);
      if (!usable) continue;
      if (
        a.certificate_expires_at &&
        a.certificate_expires_at < today &&
        !assignedIds.has(a.id)
      ) {
        continue;
      }
      const list = map.get(a.catalog_id) ?? [];
      list.push(a);
      map.set(a.catalog_id, list);
    }
    return map;
  }, [assets, order.assignments]);

  const today = new Date().toISOString().slice(0, 10);
  const flatPicks = Object.values(picks).flat();
  const certWarnings = flatPicks
    .map((p) => assets.find((a) => a.id === p.asset_id))
    .filter((a): a is AssetOption => !!a)
    .filter((a) => {
      if (!a.certificate_expires_at) return true;
      const days =
        (new Date(a.certificate_expires_at).getTime() -
          new Date(today).getTime()) /
        86400000;
      return days <= 14;
    });

  const dense = order.items.length > 1;
  const openReturns = order.assignments.filter((a) => !a.returned_at);

  function patchPick(
    itemId: string,
    slot: number,
    patch: Partial<PickState>,
  ) {
    setPicks((prev) => {
      const slots = [...(prev[itemId] ?? [])];
      while (slots.length <= slot) slots.push(emptyPick());
      slots[slot] = { ...slots[slot]!, ...patch };
      return { ...prev, [itemId]: slots };
    });
  }

  function collectAssignments() {
    return Object.entries(picks).flatMap(([order_item_id, slots]) =>
      slots
        .filter((v) => v.asset_id)
        .map((v) => ({
          order_item_id,
          asset_id: v.asset_id,
          dispatch_meter: v.dispatch_meter,
          pack_weight_kg: v.pack_weight_kg || undefined,
        })),
    );
  }

  function packValidationError(): string | null {
    for (const item of order.items) {
      const slots = picks[item.id] ?? [];
      if (slots.length < item.quantity) {
        return `Assign ${item.quantity} RRP unit${item.quantity === 1 ? "" : "s"} for ${item.catalog_name}`;
      }
      for (let i = 0; i < item.quantity; i++) {
        const slot = slots[i];
        if (!slot?.asset_id) {
          return `Assign all RRP units for ${item.catalog_name} (×${item.quantity})`;
        }
        if (!slot.cert_checked) {
          return "Complete cert checklist on each picked unit";
        }
      }
    }
    const ids = collectAssignments().map((a) => a.asset_id);
    if (new Set(ids).size !== ids.length) {
      return "Each RRP unit can only be assigned once";
    }
    return null;
  }

  function optionsForSlot(item: WorkshopOrder["items"][number], slot: number) {
    const selectedElsewhere = new Set(
      Object.entries(picks).flatMap(([itemId, slots]) =>
        slots
          .map((s, idx) =>
            itemId === item.id && idx === slot ? "" : s.asset_id,
          )
          .filter(Boolean),
      ),
    );
    return (availableByCatalog.get(item.catalog_id) ?? []).filter(
      (a) => !selectedElsewhere.has(a.id),
    );
  }

  return (
    <article className="rounded-xl border-2 border-[#111111]/15 bg-white p-4 shadow-sm">
      <header className="mb-3 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-xl font-semibold">
            {order.order_number}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={order.status} />
            <Button asChild size="sm" variant="outline">
              <Link href={`/workshop/orders/${order.id}/picking-slip`}>
                Picking slip
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/workshop/orders/${order.id}/delivery-docket`}>
                Delivery docket
              </Link>
            </Button>
            {order.status === "dispatched" ||
            order.status === "off_rent_pending" ||
            order.assignments.some((a) => a.returned_at) ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/workshop/orders/${order.id}/return-receipt`}>
                  Return receipt
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {order.clients?.company_name}
        </p>
        {certWarnings.length > 0 ? (
          <p className="rounded-lg border border-[#f5d400]/40 bg-[#f5d400]/10 px-2 py-1 text-xs text-[#111111]">
            Certificate warning:{" "}
            {certWarnings
              .map((a) =>
                !a.certificate_expires_at
                  ? `${a.serial_number} (no expiry on file)`
                  : a.certificate_expires_at < today
                    ? `${a.serial_number} EXPIRED`
                    : `${a.serial_number} expires ${a.certificate_expires_at}`,
              )
              .join("; ")}
          </p>
        ) : null}
      </header>
      <div className="space-y-3">
        {order.status === "pre_pick" || order.status === "confirmed" ? (
          <div className="space-y-3">
            <div className={cn(dense ? "space-y-2" : "space-y-3")}>
              {order.items.map((item) => {
                const slots = picks[item.id] ?? [];
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-lg border p-2.5",
                      dense && "bg-[#fafafa]",
                    )}
                  >
                    <p className="mb-2 truncate text-sm font-medium">
                      {item.catalog_name} × {item.quantity}
                    </p>
                    <div className="space-y-3">
                      {Array.from({ length: item.quantity }, (_, slotIdx) => {
                        const pick = slots[slotIdx] ?? emptyPick();
                        const missingSerial = !pick.asset_id;
                        return (
                          <div
                            key={`${item.id}-${slotIdx}`}
                            className={cn(
                              "grid gap-2",
                              item.quantity > 1 &&
                                "rounded-md border bg-white p-2",
                              dense
                                ? "grid-cols-1 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_repeat(3,minmax(0,0.7fr))] sm:items-end"
                                : "grid-cols-2 sm:grid-cols-3",
                            )}
                          >
                            <div
                              className={cn(
                                "min-w-0",
                                !dense && "col-span-2 sm:col-span-3",
                              )}
                            >
                              <Label className="text-xs">
                                {item.quantity > 1
                                  ? `RRP ${slotIdx + 1} of ${item.quantity}`
                                  : dense
                                    ? "RRP Number"
                                    : "Assign RRP (pick)"}
                              </Label>
                              <Select
                                value={pick.asset_id || undefined}
                                onValueChange={(v) => {
                                  const asset = assets.find((a) => a.id === v);
                                  patchPick(item.id, slotIdx, {
                                    asset_id: v,
                                    dispatch_meter: asset?.meter_hours ?? 0,
                                  });
                                }}
                              >
                                <SelectTrigger
                                  className={cn(
                                    "mt-1 h-11 w-full min-w-0",
                                    missingSerial
                                      ? "border-amber-500 ring-1 ring-amber-500/60"
                                      : "",
                                  )}
                                >
                                  <SelectValue placeholder="Select RRP unit…" />
                                </SelectTrigger>
                                <SelectContent
                                  position="popper"
                                  className="max-h-72 w-(--radix-select-trigger-width)"
                                >
                                  {optionsForSlot(item, slotIdx).map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {a.serial_number}
                                      {a.certificate_expires_at
                                        ? ` · cert ${a.certificate_expires_at}`
                                        : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {pick.asset_id ? (
                                <DispatchCertChecklist
                                  asset={assets.find(
                                    (a) => a.id === pick.asset_id,
                                  )}
                                  today={today}
                                />
                              ) : (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Cert checklist appears after you assign an
                                  RRP unit.
                                </p>
                              )}
                            </div>

                            <div>
                              <Label className="text-xs">Pack kg</Label>
                              <Input
                                className="mt-1 h-11"
                                type="number"
                                inputMode="decimal"
                                step="0.1"
                                value={pick.pack_weight_kg}
                                onChange={(e) =>
                                  patchPick(item.id, slotIdx, {
                                    pack_weight_kg: Number(e.target.value),
                                  })
                                }
                              />
                            </div>

                            <div
                              className={cn(
                                "flex items-center gap-2 pb-1",
                                !dense && "col-span-2 sm:col-span-3",
                              )}
                            >
                              <Checkbox
                                id={`cert-${item.id}-${slotIdx}`}
                                checked={pick.cert_checked}
                                onCheckedChange={(v) =>
                                  patchPick(item.id, slotIdx, {
                                    cert_checked: v === true,
                                  })
                                }
                              />
                              <Label
                                htmlFor={`cert-${item.id}-${slotIdx}`}
                                className="text-xs"
                              >
                                Cert checklist done (validity on file)
                              </Label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 grid gap-1">
                      <Label className="text-xs">Line notes</Label>
                      <Textarea
                        className="min-h-[2.5rem] text-sm"
                        rows={2}
                        defaultValue={item.line_notes}
                        placeholder="Ad hoc notes for packing / delivery docket"
                        onBlur={(e) => {
                          const value = e.target.value;
                          if (value === (item.line_notes ?? "")) return;
                          start(async () => {
                            const result = await updateLineNotesAction({
                              order_item_id: item.id,
                              line_notes: value,
                            });
                            if (!result.success) {
                              toast.error(result.error.message);
                            }
                          });
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <EvidenceUploader orderId={order.id} kind="dispatch" required />
            {order.status === "confirmed" ? (
              <Button
                className="h-12 w-full bg-[#111111] text-base text-[#f5d400] hover:bg-black"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const err = packValidationError();
                    if (err) {
                      toast.error(err);
                      return;
                    }
                    const result = await markReadyForDispatchAction({
                      order_id: order.id,
                      assignments: collectAssignments(),
                    });
                    if (!result.success) toast.error(result.error.message);
                    else toast.success("Marked ready for dispatch");
                  })
                }
              >
                Ready for dispatch
              </Button>
            ) : null}
            {order.status === "pre_pick" ? (
              <Button
                className="h-12 w-full bg-[#111111] text-base text-[#f5d400] hover:bg-black"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const err = packValidationError();
                    if (err) {
                      toast.error(err);
                      return;
                    }
                    const packed = await markReadyForDispatchAction({
                      order_id: order.id,
                      assignments: collectAssignments(),
                    });
                    if (!packed.success) {
                      toast.error(packed.error.message);
                      return;
                    }
                    const result = await dispatchOrderAction({
                      order_id: order.id,
                    });
                    if (!result.success) toast.error(result.error.message);
                    else toast.success("Dispatched to site");
                  })
                }
              >
                Dispatch to site
              </Button>
            ) : null}
          </div>
        ) : null}

        {order.status === "dispatched" ? (
          <div className="space-y-2">
            <Button
              className="h-12 w-full bg-[#111111] text-base text-[#f5d400] hover:bg-black"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const result = await requestOffRentAction({
                    order_id: order.id,
                    off_rent_at: new Date().toISOString(),
                  });
                  if (!result.success) toast.error(result.error.message);
                  else toast.success("Off-hire recorded. Billing clock stopped");
                })
              }
            >
              Record off-hire
            </Button>
            {canRevertDispatch ? (
              <Button
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await revertDispatchAction({
                      order_id: order.id,
                    });
                    if (!result.success) toast.error(result.error.message);
                    else toast.success("Dispatch reverted to ready for dispatch");
                  })
                }
              >
                Revert dispatch (Super Admin)
              </Button>
            ) : null}
          </div>
        ) : null}

        {(order.status === "off_rent_pending" ||
          order.status === "dispatched") &&
        openReturns.length > 0 ? (
          <div className="space-y-2">
            <div
              className={cn(
                openReturns.length > 1 ? "space-y-2" : "space-y-3",
              )}
            >
              {openReturns.map((a) => (
                <ReturnPanel
                  key={a.id}
                  orderId={order.id}
                  assignment={a}
                  pending={pending}
                  dense={openReturns.length > 1}
                  openCount={openReturns.length}
                  start={start}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ReturnPanel({
  orderId,
  assignment,
  pending,
  dense,
  openCount,
  start,
}: {
  orderId: string;
  assignment: WorkshopOrder["assignments"][number];
  pending: boolean;
  dense: boolean;
  openCount: number;
  start: (fn: () => Promise<void>) => void;
}) {
  const [notes, setNotes] = useState("");
  const [damaged, setDamaged] = useState(false);
  const [fee, setFee] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [cleanFee, setCleanFee] = useState(75);
  const [missing, setMissing] = useState(false);
  const [missingFee, setMissingFee] = useState(0);
  const [okNoDamage, setOkNoDamage] = useState(false);
  const [okNoMissing, setOkNoMissing] = useState(false);
  const [okNoOther, setOkNoOther] = useState(false);

  const qcComplete =
    (damaged || okNoDamage) &&
    (missing || okNoMissing) &&
    (dirty || okNoOther);
  const hasIssue = damaged || dirty || missing;
  const notesReady = !hasIssue || notes.trim().length > 0;

  function buildNotes(): string {
    const affirm: string[] = [];
    if (!damaged && okNoDamage) affirm.push("No damage");
    if (!missing && okNoMissing) affirm.push("No missing parts");
    if (!dirty && okNoOther) affirm.push("No other issues");
    const prefix =
      affirm.length > 0 ? `QC: ${affirm.join("; ")}.` : "";
    const body = notes.trim();
    if (prefix && body) return `${prefix} ${body}`;
    return body || prefix;
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border p-2.5",
        dense && "bg-[#fafafa]",
      )}
    >
      <p className="font-mono text-base font-semibold">
        {assignment.serial_number}
      </p>

      <div className="space-y-2 rounded-md border border-[#e4e4e7] bg-white px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          QC checklist (required)
        </p>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-2 rounded-md border px-2 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={okNoDamage}
                disabled={damaged}
                onCheckedChange={(v) => {
                  const on = v === true;
                  setOkNoDamage(on);
                  if (on) setDamaged(false);
                }}
                id={`ok-dmg-${assignment.id}`}
              />
              <Label htmlFor={`ok-dmg-${assignment.id}`} className="text-xs">
                No damage
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={damaged}
                onCheckedChange={(v) => {
                  const on = v === true;
                  setDamaged(on);
                  if (on) setOkNoDamage(false);
                }}
                id={`dmg-${assignment.id}`}
              />
              <Label htmlFor={`dmg-${assignment.id}`} className="text-xs">
                Damaged
              </Label>
            </div>
            {damaged ? (
              <>
                <Label className="text-xs">Damage fee (AUD)</Label>
                <Input
                  type="number"
                  className="h-10"
                  value={fee}
                  onChange={(e) => setFee(Number(e.target.value))}
                />
              </>
            ) : null}
          </div>

          <div className="space-y-2 rounded-md border px-2 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={okNoMissing}
                disabled={missing}
                onCheckedChange={(v) => {
                  const on = v === true;
                  setOkNoMissing(on);
                  if (on) setMissing(false);
                }}
                id={`ok-miss-${assignment.id}`}
              />
              <Label htmlFor={`ok-miss-${assignment.id}`} className="text-xs">
                No missing parts
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={missing}
                onCheckedChange={(v) => {
                  const on = v === true;
                  setMissing(on);
                  if (on) setOkNoMissing(false);
                }}
                id={`miss-${assignment.id}`}
              />
              <Label htmlFor={`miss-${assignment.id}`} className="text-xs">
                Missing
              </Label>
            </div>
            {missing ? (
              <>
                <Label className="text-xs">Missing fee (AUD)</Label>
                <Input
                  type="number"
                  className="h-10"
                  value={missingFee}
                  onChange={(e) => setMissingFee(Number(e.target.value))}
                />
              </>
            ) : null}
          </div>

          <div className="space-y-2 rounded-md border px-2 py-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={okNoOther}
                disabled={dirty}
                onCheckedChange={(v) => {
                  const on = v === true;
                  setOkNoOther(on);
                  if (on) setDirty(false);
                }}
                id={`ok-other-${assignment.id}`}
              />
              <Label htmlFor={`ok-other-${assignment.id}`} className="text-xs">
                No other issues
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={dirty}
                onCheckedChange={(v) => {
                  const on = v === true;
                  setDirty(on);
                  if (on) setOkNoOther(false);
                }}
                id={`dirty-${assignment.id}`}
              />
              <Label htmlFor={`dirty-${assignment.id}`} className="text-xs">
                Dirty / other
              </Label>
            </div>
            {dirty ? (
              <>
                <Label className="text-xs">Cleaning fee (AUD)</Label>
                <Input
                  type="number"
                  className="h-10"
                  value={cleanFee}
                  onChange={(e) => setCleanFee(Number(e.target.value))}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor={`notes-${assignment.id}`}>
          Notes{hasIssue ? " (required for issues)" : " (optional)"}
        </Label>
        <Textarea
          id={`notes-${assignment.id}`}
          className="min-h-20"
          rows={dense ? 3 : 4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            hasIssue
              ? "Describe damage, missing gear, or condition for Finance…"
              : "Optional yard notes"
          }
        />
      </div>

      <EvidenceUploader
        orderId={orderId}
        assignmentId={assignment.id}
        kind={damaged || missing ? "damage" : "return"}
      />
      <Button
        className="h-11 w-full bg-[#111111] text-sm text-[#f5d400] hover:bg-black"
        disabled={pending || !qcComplete || !notesReady}
        onClick={() =>
          start(async () => {
            if (!qcComplete) {
              toast.error(
                "Complete QC: tick No damage / No missing / No other issues, or flag each problem",
              );
              return;
            }
            if (!notesReady) {
              toast.error("Add notes describing the issues for Finance");
              return;
            }
            const result = await returnAssignmentAction({
              assignment_id: assignment.id,
              return_meter: 0,
              inspection_notes: buildNotes(),
              damaged,
              damage_fee: fee,
              dirty,
              cleaning_fee: cleanFee,
              missing,
              missing_fee: missingFee,
            });
            if (!result.success) toast.error(result.error.message);
            else if (result.data.order_closed && !result.data.invoice_drafted) {
              toast.success("Returned. Print return receipt.");
            } else if (result.data.order_closed) {
              toast.success("Returned. Draft invoice with Finance.");
            } else {
              const stillOut = Math.max(0, openCount - 1);
              toast.success(
                stillOut > 0
                  ? `Return QC done. ${stillOut} RRP unit(s) still out.`
                  : "Return QC done",
              );
            }
          })
        }
      >
        Finish return check
      </Button>
    </div>
  );
}

function DispatchCertChecklist({
  asset,
  today,
}: {
  asset: AssetOption | undefined;
  today: string;
}) {
  if (!asset) return null;
  const expiry = asset.certificate_expires_at ?? null;
  const expired = !!expiry && expiry < today;
  const missing = !expiry;
  const daysLeft =
    expiry && !expired
      ? Math.ceil(
          (new Date(expiry).getTime() - new Date(today).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;
  const statusLabel = expired
    ? "EXPIRED"
    : missing
      ? "No expiry on file"
      : daysLeft !== null && daysLeft <= 30
        ? `Valid · ${daysLeft}d left`
        : "Valid";
  const tone = expired
    ? "border-red-300 bg-red-50 text-red-900"
    : missing
      ? "border-amber-300 bg-amber-50 text-amber-950"
      : "border-emerald-300 bg-emerald-50 text-emerald-950";

  return (
    <div className={cn("mt-2 rounded-md border px-2.5 py-2 text-[11px]", tone)}>
      <p className="font-medium">
        Cert checklist · {asset.serial_number} · {statusLabel}
      </p>
      <ul className="mt-1 space-y-0.5 text-[11px] opacity-90">
        <li>
          Type: {asset.certificate_type?.trim() || "LOLER / inspection"}
        </li>
        <li>
          Cert #: {asset.certificate_number?.trim() || "—"}
        </li>
        <li>Expires: {expiry || "—"}</li>
      </ul>
    </div>
  );
}

export function TurnaroundList({
  assets,
}: {
  assets: AssetOption[];
}) {
  const [pending, start] = useTransition();
  const queue = assets.filter((a) => a.status === "in_inspection");
  if (queue.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="space-y-1">
          <CardTitle className="font-display text-base font-semibold">
            Wash / prep before rent again{" "}
            <span className="tabular-nums text-muted-foreground">
              ({queue.length})
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            In inspection until wash/prep is done.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Serial #</TableHead>
              <TableHead>Model / Catalog</TableHead>
              <TableHead>Last hire info</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono font-medium">
                  {a.serial_number}
                </TableCell>
                <TableCell>{a.catalog_label ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.last_order_number
                    ? `Last return: ${a.last_order_number}${
                        a.last_client_name ? ` · ${a.last_client_name}` : ""
                      }`
                    : "Waiting for wash / prep after return QC"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    className="h-8 bg-[#111111] text-[#f5d400] hover:bg-black text-xs font-medium"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await completeTurnaroundAction({
                          asset_id: a.id,
                        });
                        if (!result.success) toast.error(result.error.message);
                        else
                          toast.success(
                            `${a.serial_number} available for hire again`,
                          );
                      })
                    }
                  >
                    Wash/prep done
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

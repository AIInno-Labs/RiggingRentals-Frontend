"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createOrderAction, updateDraftOrderAction } from "@/features/orders/actions";
import {
  checkAvailabilityAction,
  checkWindowAvailabilityAction,
} from "@/features/availability/actions";
import {
  billableDaysBetween,
  calculateTieredRate,
} from "@/features/pricing/calculate-rate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { EQUIPMENT_CATEGORIES } from "@/features/catalog/equipment-categories";

type ClientOpt = { id: string; label: string };
type CatalogOpt = {
  id: string;
  label: string;
  category: string;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  available_count?: number;
};

type Line = {
  category: string;
  catalog_id: string;
  quantity: number;
  available?: number;
  rate?: number;
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  rate_override?: boolean;
  query?: string;
  line_notes?: string;
};

export type OrderBuilderInitial = {
  orderId: string;
  orderNumber: string;
  clientId: string;
  startAt: string;
  endAt: string;
  damageWaiver: boolean;
  deposit: number;
  fuel: number;
  notes: string;
  jobsite: string;
  deliveryAddress: string;
  po: string;
  deliveryRequired: boolean;
  pickupRequired: boolean;
  lines: Line[];
};

/** date input YYYY-MM-DD → ISO start/end of local day */
function dateToStartIso(date: string) {
  return new Date(`${date}T00:00:00`).toISOString();
}
function dateToEndIso(date: string) {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

function clampNonNeg(raw: string, fallback = 0): number {
  if (raw.trim() === "") return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function clampQty(raw: string, fallback = 1): number {
  if (raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function OrderBuilderForm({
  clients,
  catalog,
  defaultClientId = "",
  initial,
}: {
  clients: ClientOpt[];
  catalog: CatalogOpt[];
  defaultClientId?: string;
  initial?: OrderBuilderInitial;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const defaultClient = clients.find(
    (c) => c.id === (initial?.clientId || defaultClientId),
  );
  const [clientQuery, setClientQuery] = useState(defaultClient?.label ?? "");
  const [clientId, setClientId] = useState(
    initial?.clientId || (defaultClient ? defaultClientId : ""),
  );
  const [startAt, setStartAt] = useState(initial?.startAt ?? "");
  const [endAt, setEndAt] = useState(initial?.endAt ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial?.lines?.length
      ? initial.lines
      : [{ category: "", catalog_id: "", quantity: 1, line_notes: "" }],
  );
  const [damageWaiver, setDamageWaiver] = useState(
    initial?.damageWaiver ?? false,
  );
  const [deposit, setDeposit] = useState(initial?.deposit ?? 0);
  const [fuel, setFuel] = useState(initial?.fuel ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [total, setTotal] = useState(0);
  const [jobsite, setJobsite] = useState(initial?.jobsite ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(
    initial?.deliveryAddress ?? "",
  );
  const [po, setPo] = useState(initial?.po ?? "");
  const [deliveryRequired, setDeliveryRequired] = useState(
    initial?.deliveryRequired ?? true,
  );
  const [pickupRequired, setPickupRequired] = useState(
    initial?.pickupRequired ?? true,
  );
  const [windowQty, setWindowQty] = useState<Record<string, number> | null>(
    null,
  );
  const [pickerOpenIdx, setPickerOpenIdx] = useState<number | null>(null);
  const [pickerHighlight, setPickerHighlight] = useState(0);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const pickerWrapRef = useRef<HTMLDivElement | null>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const availGen = useRef(0);

  const catalogMap = useMemo(
    () => new Map(catalog.map((c) => [c.id, c])),
    [catalog],
  );

  const uniqueClients = useMemo(() => {
    const seen = new Set<string>();
    return clients.filter((c) => {
      const key = c.label.toLowerCase();
      if (seen.has(key) || seen.has(c.id)) return false;
      seen.add(c.id);
      seen.add(key);
      return true;
    });
  }, [clients]);

  const selectedClient = useMemo(
    () => uniqueClients.find((c) => c.id === clientId) ?? defaultClient,
    [uniqueClients, clientId, defaultClient],
  );

  const filteredClients = useMemo(() => {
    const q = clientQuery.trim().toLowerCase();
    let list = !q
      ? uniqueClients
      : uniqueClients.filter((c) => c.label.toLowerCase().includes(q));
    // Always keep the selected client visible in the picker
    if (selectedClient && !list.some((c) => c.id === selectedClient.id)) {
      list = [selectedClient, ...list];
    }
    return list;
  }, [uniqueClients, clientQuery, selectedClient]);

  useEffect(() => {
    if (!defaultClientId) return;
    const match = clients.find((c) => c.id === defaultClientId);
    if (!match) return;
    setClientId(match.id);
    setClientQuery((prev) => prev || match.label);
  }, [defaultClientId, clients]);

  const estGrand = Math.round((total + fuel) * 100) / 100;

  async function computeLine(
    line: Line,
    start: string,
    end: string,
    opts?: { skipAvailability?: boolean; availableHint?: number },
  ): Promise<Line> {
    const inCat = line.category
      ? catalog.filter((c) => c.category === line.category)
      : [];
    const avgDaily =
      inCat.length > 0
        ? inCat.reduce((s, c) => s + c.daily_rate, 0) / inCat.length
        : 0;
    const avgWeekly =
      inCat.length > 0
        ? inCat.reduce((s, c) => s + c.weekly_rate, 0) / inCat.length
        : 0;
    const avgMonthly =
      inCat.length > 0
        ? inCat.reduce((s, c) => s + c.monthly_rate, 0) / inCat.length
        : 0;

    const c = line.catalog_id ? catalogMap.get(line.catalog_id) : undefined;
    const daily = line.rate_override
      ? (line.daily_rate ?? c?.daily_rate ?? avgDaily)
      : (c?.daily_rate ?? avgDaily);
    const weekly = line.rate_override
      ? (line.weekly_rate ?? c?.weekly_rate ?? avgWeekly)
      : (c?.weekly_rate ?? avgWeekly);
    const monthly = line.rate_override
      ? (line.monthly_rate ?? c?.monthly_rate ?? avgMonthly)
      : (c?.monthly_rate ?? avgMonthly);

    if (!start || !end) {
      return {
        ...line,
        available: c?.available_count,
        daily_rate: daily,
        weekly_rate: weekly,
        monthly_rate: monthly,
        rate: undefined,
      };
    }

    let available = opts?.availableHint ?? c?.available_count;
    if (line.catalog_id && !opts?.skipAvailability) {
      const avail = await checkAvailabilityAction({
        catalogId: line.catalog_id,
        startAt: dateToStartIso(start),
        endAt: dateToEndIso(end),
        requestedQty: line.quantity,
      });
      available = avail.success ? avail.data.availableQty : c?.available_count;
    }

    let rateAmount: number | undefined;
    try {
      const days = billableDaysBetween(
        dateToStartIso(start),
        dateToEndIso(end),
      );
      if (days > 0) {
        rateAmount = calculateTieredRate({
          days,
          dailyRate: daily,
          weeklyRate: weekly,
          monthlyRate: monthly,
        }).amount;
      }
    } catch {
      rateAmount = undefined;
    }
    return {
      ...line,
      available,
      daily_rate: daily,
      weekly_rate: weekly,
      monthly_rate: monthly,
      rate: rateAmount,
    };
  }

  async function refreshLine(index: number, next: Line) {
    const copy = [...linesRef.current];
    copy[index] = next;
    setLines(copy);
    const gen = ++availGen.current;
    const computed = await computeLine(next, startAt, endAt);
    if (gen !== availGen.current) return;
    const updated = [...linesRef.current];
    updated[index] = computed;
    setLines(updated);
    const sum = updated.reduce((s, l) => s + (l.rate ?? 0) * l.quantity, 0);
    setTotal(Math.round(sum * 100) / 100);
  }

  async function refreshAllLinesFromWindow(
    start: string,
    end: string,
    qtyByCatalog: Record<string, number>,
    gen: number,
  ) {
    const current = linesRef.current;
    const updated = await Promise.all(
      current.map((line) =>
        computeLine(line, start, end, {
          skipAvailability: true,
          availableHint: line.catalog_id
            ? (qtyByCatalog[line.catalog_id] ?? 0)
            : undefined,
        }),
      ),
    );
    if (gen !== availGen.current) return;
    setLines(updated);
    const sum = updated.reduce((s, l) => s + (l.rate ?? 0) * l.quantity, 0);
    setTotal(Math.round(sum * 100) / 100);
  }

  useEffect(() => {
    if (!startAt || !endAt) {
      availGen.current += 1;
      setWindowQty(null);
      return;
    }
    const gen = ++availGen.current;
    // Debounce heavy availability round-trips while dates are still being edited.
    const timer = window.setTimeout(() => {
      void checkWindowAvailabilityAction({
        startAt: dateToStartIso(startAt),
        endAt: dateToEndIso(endAt),
      }).then((r) => {
        if (gen !== availGen.current) return;
        if (!r.success) return;
        setWindowQty(r.data);
        void refreshAllLinesFromWindow(startAt, endAt, r.data, gen);
      });
    }, 280);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only recompute when dates change
  }, [startAt, endAt]);

  function pickerStockHint(c: CatalogOpt): string {
    const yard = c.available_count ?? 0;
    if (startAt && endAt && windowQty) {
      const n = windowQty[c.id] ?? 0;
      if (n === yard) return ` · ${n} for these dates`;
      return ` · ${n} for these dates · ${yard} in yard`;
    }
    return ` · ${yard} in yard now`;
  }

  function catalogMatches(c: CatalogOpt, q: string): boolean {
    if (!q) return true;
    const hay = `${c.label} ${c.daily_rate}`.toLowerCase();
    return q
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .every((token) => hay.includes(token));
  }

  function optionsForLine(line: Line): CatalogOpt[] {
    const q = (line.query ?? "").trim().toLowerCase();
    let list = catalog.filter((c) =>
      line.category ? c.category === line.category : true,
    );
    if (q) list = list.filter((c) => catalogMatches(c, q));
    if (windowQty) {
      list = [...list].sort(
        (a, b) => (windowQty[b.id] ?? 0) - (windowQty[a.id] ?? 0),
      );
    }
    if (line.catalog_id && !list.some((c) => c.id === line.catalog_id)) {
      const sel = catalogMap.get(line.catalog_id);
      if (sel) list = [sel, ...list];
    }
    return list;
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!pickerWrapRef.current?.contains(e.target as Node)) {
        setPickerOpenIdx(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pickCatalog(idx: number, line: Line, item: CatalogOpt) {
    setPickerOpenIdx(null);
    void refreshLine(idx, {
      ...line,
      category: item.category || line.category,
      catalog_id: item.id,
      query: item.label,
      rate_override: false,
      daily_rate: item.daily_rate,
      weekly_rate: item.weekly_rate,
      monthly_rate: item.monthly_rate,
    });
  }

  return (
    <form
      className="relative grid items-start gap-6 pb-24 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            if (!clientId) {
              toast.error("Select a client");
              return;
            }
            if (!startAt || !endAt) {
              toast.error("Choose start and end dates");
              return;
            }
            if (endAt < startAt) {
              toast.error("End date must be on or after start date");
              return;
            }
            const items = lines
              .filter((l) => l.category.trim())
              .map((l) => ({
                category: l.category,
                catalog_id: l.catalog_id || "",
                quantity: clampQty(String(l.quantity)),
                line_notes: l.line_notes ?? "",
                daily_rate: l.daily_rate,
                weekly_rate: l.weekly_rate,
                monthly_rate: l.monthly_rate,
                rate_override: l.rate_override === true,
              }));
            if (items.length === 0) {
              toast.error("Add at least one equipment line with a category");
              return;
            }
            const over = lines.find(
              (l) =>
                l.catalog_id &&
                l.available != null &&
                l.quantity > l.available,
            );
            if (over) {
              const c = catalogMap.get(over.catalog_id);
              const yard = c?.available_count ?? 0;
              toast.error(
                `Need ${over.quantity}× ${c?.label ?? "item"} for these dates but ${over.available} are free (${yard} in yard; other quotes/hires hold the rest).`,
              );
              return;
            }

            const payload = {
              client_id: clientId,
              start_at: dateToStartIso(startAt),
              end_at: dateToEndIso(endAt),
              damage_waiver: damageWaiver,
              fuel_surcharge: clampNonNeg(String(fuel)),
              security_deposit: clampNonNeg(String(deposit)),
              notes,
              jobsite_name: jobsite,
              delivery_address: deliveryAddress,
              purchase_order: po,
              delivery_required: deliveryRequired,
              pickup_required: pickupRequired,
              items,
            };
            const result = initial
              ? await updateDraftOrderAction({
                  ...payload,
                  order_id: initial.orderId,
                })
              : await createOrderAction(payload);
            if (!result.success) {
              toast.error(result.error.message);
              return;
            }
            toast.success(
              initial
                ? `Quote ${result.data.order_number} updated`
                : `Quote ${result.data.order_number} saved. Confirm it from Orders`,
            );
            router.push(
              initial
                ? `/admin/orders/${initial.orderId}`
                : "/admin/pipeline",
            );
            router.refresh();
          } catch (err) {
            toast.error(
              err instanceof Error ? err.message : "Could not save quote",
            );
          }
        });
      }}
    >
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Client & site
        </p>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="client_id">Client</Label>
            {/* Selected id — first control after label for form/automation */}
            <input
              id="client_id"
              name="client_id"
              type="text"
              readOnly
              required
              value={clientId}
              aria-label="Selected client id"
              className="sr-only"
              tabIndex={-1}
            />
            {selectedClient ? (
              <p className="rounded-lg border border-[#111111]/15 bg-[#fafafa] px-2.5 py-2 text-sm">
                <span className="font-medium text-[#111111]">
                  {selectedClient.label}
                </span>
                <button
                  type="button"
                  className="ml-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => {
                    setClientId("");
                    setClientQuery("");
                    setClientOpen(true);
                  }}
                >
                  Change
                </button>
              </p>
            ) : (
              <div className="relative">
                <Input
                  value={clientQuery}
                  onChange={(e) => {
                    setClientQuery(e.target.value);
                    setClientOpen(true);
                  }}
                  onFocus={() => setClientOpen(true)}
                  placeholder="Search clients…"
                  className="h-9 w-full"
                  autoComplete="off"
                />
                {clientOpen ? (
                  <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[#111111]/15 bg-white py-1 shadow-lg">
                    {filteredClients.length === 0 ? (
                      <li className="px-3 py-2 text-xs text-muted-foreground">
                        No client matching “{clientQuery}”
                      </li>
                    ) : (
                      filteredClients.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f5d400]/40"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setClientId(c.id);
                              setClientQuery(c.label);
                              setClientOpen(false);
                            }}
                          >
                            {c.label}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <Label>Start</Label>
              <Input
                type="date"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label>End</Label>
              <Input
                type="date"
                required
                value={endAt}
                min={startAt || undefined}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1">
              <Label>Jobsite</Label>
              <Input
                value={jobsite}
                onChange={(e) => setJobsite(e.target.value)}
                placeholder="Project / site name"
                className="w-full"
              />
            </div>
            <div className="min-w-0 space-y-1">
              <Label>Customer PO</Label>
              <Input
                value={po}
                onChange={(e) => setPo(e.target.value)}
                placeholder="PO-…"
                className="w-full"
              />
            </div>
          </div>

          <div className="min-w-0 space-y-1">
            <Label>Delivery address</Label>
            <Input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={deliveryRequired}
              onCheckedChange={(v) => setDeliveryRequired(v === true)}
              id="delivery_required"
            />
            <Label htmlFor="delivery_required">Delivery required</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={pickupRequired}
              onCheckedChange={(v) => setPickupRequired(v === true)}
              id="pickup_required"
            />
            <Label htmlFor="pickup_required">Pickup required</Label>
          </div>
        </div>
      </div>

      <div className="space-y-2 lg:border-l lg:border-border lg:pl-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Equipment
            </p>
            <p className="text-[11px] text-muted-foreground">
              Free qty is for your start–end dates. In-yard units can already be
              held by other quotes.
              {startAt && endAt ? (
                <>
                  {" "}
                  <Link
                    href={`/admin/availability?from=${startAt}&to=${endAt}`}
                    className="brand-link font-medium"
                  >
                    See yard for these dates
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              setLines([
                ...linesRef.current,
                { category: "", catalog_id: "", quantity: 1, line_notes: "" },
              ])
            }
          >
            + Add line
          </Button>
        </div>
        {lines.map((line, idx) => (
          <div key={idx} className="space-y-2 rounded-xl border border-[#e4e4e7] p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label className="text-xs">Category</Label>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={line.category}
                  disabled={pending}
                  onChange={(e) => {
                    const category = e.target.value;
                    void refreshLine(idx, {
                      ...line,
                      category,
                      catalog_id: "",
                      query: "",
                      rate_override: false,
                      available: undefined,
                    });
                  }}
                >
                  <option value="">Select category…</option>
                  {EQUIPMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">
                  Sub Category{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional on draft)
                  </span>
                </Label>
                {line.catalog_id && catalogMap.get(line.catalog_id) ? (
                  <p className="rounded-lg border border-[#111111]/15 bg-[#fafafa] px-2.5 py-2 text-sm">
                    <span className="font-medium text-[#111111]">
                      {catalogMap.get(line.catalog_id)?.label}
                    </span>
                    <button
                      type="button"
                      className="ml-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => {
                        void refreshLine(idx, {
                          ...line,
                          catalog_id: "",
                          available: undefined,
                          query: "",
                        });
                        setPickerOpenIdx(idx);
                      }}
                    >
                      Change
                    </button>
                  </p>
                ) : (
                  <div
                    className="relative min-w-0"
                    ref={pickerOpenIdx === idx ? pickerWrapRef : undefined}
                  >
                    <Input
                      value={line.query ?? ""}
                      disabled={!line.category || pending}
                      onChange={(e) => {
                        const query = e.target.value;
                        const copy = [...linesRef.current];
                        copy[idx] = { ...line, query };
                        setLines(copy);
                        setPickerHighlight(0);
                        setPickerOpenIdx(idx);
                      }}
                      onFocus={() => {
                        if (!line.category) return;
                        setPickerHighlight(0);
                        setPickerOpenIdx(idx);
                      }}
                      onKeyDown={(e) => {
                        const opts = optionsForLine(line);
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setPickerOpenIdx(idx);
                          setPickerHighlight((h) =>
                            opts.length ? Math.min(h + 1, opts.length - 1) : 0,
                          );
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setPickerHighlight((h) => Math.max(h - 1, 0));
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const hit = opts[pickerHighlight] ?? opts[0];
                          if (hit) pickCatalog(idx, line, hit);
                        } else if (e.key === "Escape") {
                          setPickerOpenIdx(null);
                        }
                      }}
                      placeholder={
                        line.category
                          ? "Search sub category (or leave blank)…"
                          : "Pick a category first"
                      }
                      className="h-10 w-full"
                      autoComplete="off"
                    />
                    {pickerOpenIdx === idx && line.category ? (
                      <ul
                        role="listbox"
                        className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[#111111]/15 bg-white py-1 shadow-lg"
                      >
                        {optionsForLine(line).length === 0 ? (
                          <li className="px-3 py-3 text-xs text-muted-foreground">
                            No sub categories in this category
                          </li>
                        ) : (
                          optionsForLine(line).map((c, i) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={i === pickerHighlight}
                                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                                  i === pickerHighlight
                                    ? "bg-[#f5d400]/40"
                                    : "hover:bg-[#f4f4f5]"
                                }`}
                                onMouseEnter={() => setPickerHighlight(i)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pickCatalog(idx, line, c)}
                              >
                                <span className="font-medium">{c.label}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  ${c.daily_rate}/day
                                  {pickerStockHint(c)}
                                </span>
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-end">
              <div className="grid gap-1">
                <Label className="text-xs">Qty</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={line.quantity}
                  className="w-full min-w-0"
                  onChange={(e) =>
                    void refreshLine(idx, {
                      ...line,
                      quantity: clampQty(e.target.value, line.quantity),
                    })
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Daily rate (AUD)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.daily_rate ?? ""}
                  placeholder="Suggested"
                  className="w-full min-w-0"
                  onChange={(e) => {
                    const daily_rate = clampNonNeg(
                      e.target.value,
                      line.daily_rate ?? 0,
                    );
                    void refreshLine(idx, {
                      ...line,
                      daily_rate,
                      weekly_rate: line.weekly_rate ?? daily_rate * 4,
                      monthly_rate: line.monthly_rate ?? daily_rate * 12,
                      rate_override: true,
                    });
                  }}
                />
              </div>
              <div className="col-span-2 flex flex-wrap items-center gap-2 sm:justify-end">
                <p
                  className={
                    line.catalog_id &&
                    line.available != null &&
                    line.quantity > line.available
                      ? "text-xs text-[#8f1d14]"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {!line.catalog_id
                    ? "Category quote — assign sub category before confirm"
                    : startAt && endAt
                      ? `${line.available ?? "—"} free these dates`
                      : `${line.available ?? "—"} in yard`}
                  {line.rate != null
                    ? ` · $${line.rate.toFixed(2)}`
                    : " · Rate —"}
                  {line.rate_override ? " · override" : ""}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  disabled={lines.length <= 1}
                  onClick={() => {
                    if (linesRef.current.length <= 1) return;
                    const next = linesRef.current.filter((_, i) => i !== idx);
                    setLines(next);
                    const sum = next.reduce(
                      (s, l) => s + (l.rate ?? 0) * l.quantity,
                      0,
                    );
                    setTotal(Math.round(sum * 100) / 100);
                  }}
                >
                  Remove
                </Button>
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Line notes</Label>
              <Input
                value={line.line_notes ?? ""}
                placeholder="Worker / site notes for this line"
                className="w-full"
                onChange={(e) => {
                  const copy = [...linesRef.current];
                  copy[idx] = { ...line, line_notes: e.target.value };
                  setLines(copy);
                }}
              />
            </div>
          </div>
        ))}

      <div className="space-y-3 border-t border-border pt-4">
        <button
          type="button"
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => setExtrasOpen((v) => !v)}
        >
          {extrasOpen ? "Hide" : "Fuel, deposit & notes"}
        </button>
        {extrasOpen ? (
          <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <Label>Fuel surcharge</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={fuel}
              className="w-full"
              onChange={(e) => setFuel(clampNonNeg(e.target.value, fuel))}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label>Security deposit</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={deposit}
              className="w-full"
              onChange={(e) => setDeposit(clampNonNeg(e.target.value, deposit))}
            />
          </div>
          <div className="flex items-center gap-2 sm:pt-7">
            <Checkbox
              checked={damageWaiver}
              onCheckedChange={(v) => setDamageWaiver(v === true)}
              id="damage_waiver"
            />
            <Label htmlFor="damage_waiver">Damage waiver</Label>
          </div>
        </div>
        <div className="grid gap-1">
          <Label>Quote / job notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Shown on quotation and picking slip"
          />
        </div>
          </>
        ) : null}
      </div>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-border bg-background/95 px-1 py-3 backdrop-blur lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Est. rental total</p>
            <p className="font-display text-2xl font-semibold tabular-nums">
              ${estGrand.toFixed(2)}
            </p>
            {fuel > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                includes ${fuel.toFixed(2)} fuel
              </p>
            ) : null}
          </div>
          <Button type="submit" disabled={pending} aria-busy={pending} className="min-w-[10rem]">
            {pending ? "Saving…" : initial ? "Save draft changes" : "Save quote (draft)"}
          </Button>
        </div>
      </div>
    </form>
  );
}

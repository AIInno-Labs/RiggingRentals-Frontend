"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyDiscountAction,
  approveInvoiceAction,
  compileInvoiceAction,
  markInvoicePaidAction,
  markInvoiceSentAction,
  markInvoiceAccountingSyncedAction,
  runMonthEndBillingAction,
  updateDraftInvoiceLineAction,
  addDraftInvoiceLineAction,
} from "@/features/billing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDateAu } from "@/lib/format-date";

type InvoiceView = {
  id: string;
  invoice_number: string;
  status: string;
  kind: string;
  period_start: string | null;
  period_end: string | null;
  payment_due_at: string | null;
  subtotal: number;
  discount_amount: number;
  gst_amount: number;
  deposit_applied: number;
  total: number;
  notes: string;
  order_id: string;
  order_number: string;
  account_name: string;
  client_id: string;
  sent_at: string | null;
  paid_at: string | null;
  paid_amount: number;
  accounting_synced_at: string | null;
  lines: {
    id: string;
    kind: string;
    description: string;
    quantity: number;
    unit_amount: number;
    line_total: number;
  }[];
};

type CompileOrder = {
  id: string;
  order_number: string;
  client_name: string | null;
  has_qc_fees?: boolean;
};

export type BillingStage =
  | "draft"
  | "send"
  | "collect"
  | "overdue"
  | "xero"
  | "paid";

const STAGES: {
  id: BillingStage;
  label: string;
  hint: string;
}[] = [
  { id: "draft", label: "Needs approve", hint: "Review & approve drafts" },
  { id: "send", label: "Needs send", hint: "Email to customer" },
  { id: "collect", label: "Awaiting payment", hint: "Due later / open" },
  { id: "overdue", label: "Overdue", hint: "Past payment due" },
  { id: "xero", label: "Needs Xero", hint: "Mark entered in books" },
  { id: "paid", label: "Paid", hint: "Archive" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function invoiceStage(inv: InvoiceView, today: string): BillingStage | null {
  if (inv.status === "void") return null;
  if (inv.status === "draft") return "draft";
  if (inv.paid_at) {
    if (!inv.accounting_synced_at) return "xero";
    return "paid";
  }
  if (inv.status === "approved" && !inv.sent_at) return "send";
  if (
    inv.payment_due_at &&
    inv.payment_due_at < today
  ) {
    return "overdue";
  }
  if (inv.status === "approved") return "collect";
  return null;
}

function money(n: number): string {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
  });
}

function mapLegacyStatus(raw?: string): BillingStage | undefined {
  if (!raw) return undefined;
  if (raw === "draft") return "draft";
  if (raw === "approved") return "send";
  if (raw === "paid") return "paid";
  if (
    raw === "send" ||
    raw === "collect" ||
    raw === "overdue" ||
    raw === "xero"
  ) {
    return raw;
  }
  return undefined;
}

export function BillingDashboard({
  returnedOrders,
  invoices,
  stageFilter,
  initialQuery = "",
}: {
  returnedOrders: CompileOrder[];
  invoices: InvoiceView[];
  stageFilter?: string;
  initialQuery?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const today = todayIso();

  function run(fn: () => Promise<void>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  const q = query.trim().toLowerCase();

  const searched = useMemo(() => {
    if (!q) return invoices;
    return invoices.filter((inv) => {
      const order = inv.order_number.toLowerCase();
      const num = inv.invoice_number.toLowerCase();
      const account = inv.account_name.toLowerCase();
      return (
        order.includes(q) ||
        order.replace(/^ro-/, "").includes(q.replace(/^ro-/, "")) ||
        num.includes(q) ||
        account.includes(q)
      );
    });
  }, [invoices, q]);

  const counts = useMemo(() => {
    const c: Record<BillingStage, number> = {
      draft: 0,
      send: 0,
      collect: 0,
      overdue: 0,
      xero: 0,
      paid: 0,
    };
    for (const inv of invoices) {
      const s = invoiceStage(inv, today);
      if (s) c[s] += 1;
    }
    return c;
  }, [invoices, today]);

  const defaultStage: BillingStage =
    counts.draft > 0
      ? "draft"
      : counts.send > 0
        ? "send"
        : counts.overdue > 0
          ? "overdue"
          : counts.collect > 0
            ? "collect"
            : counts.xero > 0
              ? "xero"
              : "paid";

  const activeStage: BillingStage =
    mapLegacyStatus(stageFilter) ?? defaultStage;

  const visible = useMemo(() => {
    return searched.filter((inv) => invoiceStage(inv, today) === activeStage);
  }, [searched, activeStage, today]);

  const visibleReturned = useMemo(() => {
    if (!q) return returnedOrders;
    return returnedOrders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        (o.client_name?.toLowerCase().includes(q) ?? false),
    );
  }, [returnedOrders, q]);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-display text-2xl font-semibold">Finance desk</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Approve, send, and collect tax invoices.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {STAGES.map((s) => {
          const active = activeStage === s.id;
          return (
            <Link
              key={s.id}
              href={`/billing?stage=${s.id}`}
              prefetch
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-colors",
                active
                  ? "border-[#111111] bg-[#111111] text-[#f5d400]"
                  : "border-[#e4e4e7] bg-white hover:border-[#111111]/40",
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {s.label}
              </p>
              <p className="font-display text-2xl font-semibold tabular-nums">
                {counts[s.id]}
              </p>
              <p
                className={cn(
                  "text-[11px]",
                  active ? "text-[#f5d400]/80" : "text-muted-foreground",
                )}
              >
                {s.hint}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1 grid gap-1">
          <Label htmlFor="invoice_search" className="text-xs text-muted-foreground">
            Find invoice or customer
          </Label>
          <Input
            id="invoice_search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Customer, RO-… or INV-…"
            className="h-9 bg-white"
            autoComplete="off"
          />
        </div>
        {q ? (
          <button
            type="button"
            className="brand-link pb-2 text-sm"
            onClick={() => setQuery("")}
          >
            Clear search
          </button>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <section className="space-y-3">
          <div>
            <h3 className="font-display text-lg font-semibold">
              {STAGES.find((s) => s.id === activeStage)?.label}{" "}
              <span className="tabular-nums text-muted-foreground">
                ({visible.length})
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              One next action per invoice. Expand a row for line items and
              totals.
            </p>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#d4d4d8] px-4 py-8 text-center text-sm text-muted-foreground">
              {q
                ? "No invoices match that search in this stage."
                : "Nothing in this stage. Pick another tile or use Tools."}
            </p>
          ) : (
            <div className="space-y-2">
              {visible.map((inv) => {
                const open = !!expanded[inv.id];
                return (
                  <article
                    key={inv.id}
                    id={inv.id}
                    className={cn(
                      "rounded-xl border bg-white p-4 shadow-sm",
                      activeStage === "overdue"
                        ? "border-[#b42318]/40"
                        : "border-[#111111]/10",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold">{inv.account_name}</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-mono text-foreground">
                            {inv.invoice_number}
                          </span>
                          {inv.order_number ? (
                            <>
                              {" · "}
                              <Link
                                href={`/admin/orders/${inv.order_id}`}
                                className="brand-link"
                              >
                                {inv.order_number}
                              </Link>
                            </>
                          ) : null}
                          {" · "}
                          <span className="capitalize">{inv.kind}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {inv.period_start && inv.period_end
                            ? `${formatDateAu(inv.period_start)} → ${formatDateAu(inv.period_end)}`
                            : "No hire period"}
                          {" · Due "}
                          {inv.payment_due_at
                            ? formatDateAu(inv.payment_due_at)
                            : "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-xl font-semibold tabular-nums">
                          {money(inv.total)}
                        </p>
                        <div className="mt-1 flex flex-wrap justify-end gap-1">
                          {inv.status === "draft" ? (
                            <StatusPill status="draft" />
                          ) : null}
                          {inv.status === "approved" && !inv.paid_at ? (
                            <StatusPill status="approved" />
                          ) : null}
                          {inv.sent_at ? <StatusPill status="sent" /> : null}
                          {inv.paid_at ? <StatusPill status="paid" /> : null}
                          {inv.accounting_synced_at ? (
                            <StatusPill status="synced" />
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <PrimaryCta
                        inv={inv}
                        stage={activeStage}
                        pending={pending}
                        run={run}
                      />
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="h-10 px-3 leading-none"
                      >
                        <Link href={`/billing/invoices/${inv.id}/export`}>
                          Tax invoice
                        </Link>
                      </Button>
                      {inv.order_id ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-10 px-3 leading-none"
                        >
                          <Link
                            href={`/workshop/orders/${inv.order_id}/return-receipt`}
                          >
                            Return receipt
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-10 px-3 leading-none"
                        onClick={() => toggleExpand(inv.id)}
                      >
                        {open ? "Hide lines" : "Show lines"}
                      </Button>
                    </div>

                    {open ? (
                      <div className="mt-4 space-y-3 border-t pt-3">
                        {inv.status === "draft" ? (
                          <DraftLinesEditor
                            inv={inv}
                            pending={pending}
                            run={run}
                          />
                        ) : (
                          <>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Description</TableHead>
                                  <TableHead>Qty</TableHead>
                                  <TableHead>Unit</TableHead>
                                  <TableHead>Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {inv.lines.map((l) => (
                                  <TableRow key={l.id}>
                                    <TableCell>
                                      <span className="text-xs uppercase text-muted-foreground">
                                        {l.kind}
                                      </span>
                                      <br />
                                      {l.description}
                                    </TableCell>
                                    <TableCell>{l.quantity}</TableCell>
                                    <TableCell>
                                      {l.unit_amount.toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                      {l.line_total.toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="text-sm">
                              <p>Subtotal: {money(inv.subtotal)}</p>
                              <p>GST: {money(inv.gst_amount)}</p>
                              <p>Discount: {money(inv.discount_amount)}</p>
                              {inv.deposit_applied > 0 ? (
                                <p>
                                  Deposit applied: {money(inv.deposit_applied)}
                                </p>
                              ) : null}
                              {inv.paid_at ? (
                                <p>Paid amount: {money(inv.paid_amount)}</p>
                              ) : null}
                              <p className="text-base font-semibold">
                                Total: {money(inv.total)}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-3 lg:sticky lg:top-20">
          <div className="space-y-3 rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
            <div>
              <h3 className="font-display text-lg font-semibold">Tools</h3>
              <p className="text-xs text-muted-foreground">
                Month-end and accounting export. Day-to-day work stays in the
                queue.
              </p>
            </div>
            <Button
              className="h-11 w-full bg-[#f5d400] text-[#111111] hover:bg-[#e6c600]"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await runMonthEndBillingAction({
                    year,
                    month,
                  });
                  if (!result.success) toast.error(result.error.message);
                  else
                    toast.success(
                      `Month-end: ${result.data.created} draft(s), ${result.data.skipped} skipped`,
                    );
                })
              }
            >
              Generate {now.toLocaleString("en-AU", { month: "long" })} interim
              invoices
            </Button>
            <Button asChild variant="outline" className="h-11 w-full">
              <a href="/billing/xero-export">Download Xero CSV</a>
            </Button>
          </div>

          <div className="space-y-3 rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm">
            <div>
              <h3 className="font-display text-base font-semibold">
                Returned hires needing a bill
              </h3>
              <p className="text-xs text-muted-foreground">
                Only if return QC did not open a draft. Usually drafts appear
                under Needs approve automatically after workshop finishes QC.
              </p>
            </div>
            {visibleReturned.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {q
                  ? "No returned hires match that search."
                  : "Nothing waiting — drafts are in Needs approve, or hires are already billed."}
              </p>
            ) : (
              <ul className="space-y-2">
                        {visibleReturned.map((o) => (
                  <li
                    key={o.id}
                    className="flex items-center gap-2 rounded-lg border px-2.5 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {o.client_name ?? `Order ${o.order_number}`}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {o.order_number}
                        {o.has_qc_fees ? " · QC fees on file" : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="ml-auto h-9 shrink-0"
                      disabled={pending}
                      onClick={() =>
                        run(async () => {
                          const result = await compileInvoiceAction({
                            order_id: o.id,
                          });
                          if (!result.success) {
                            const msg = result.error.message;
                            if (
                              /unbilled|nothing left|no hire days|duplicate key|invoice_number/i.test(
                                msg,
                              )
                            ) {
                              toast.message(
                                /duplicate|invoice_number/i.test(msg)
                                  ? "Could not create draft — try again"
                                  : "Already fully billed — nothing left to invoice",
                              );
                            } else toast.error(msg);
                            return;
                          }
                          if (result.data.skipped) {
                            toast.message(
                              result.data.reason ??
                                "No hire days or fees to bill",
                            );
                            return;
                          }
                          toast.success(
                            `Draft invoice for ${o.order_number} — review under Needs approve`,
                          );
                        })
                      }
                    >
                      Create draft
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PrimaryCta({
  inv,
  stage,
  pending,
  run,
}: {
  inv: InvoiceView;
  stage: BillingStage;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const btn =
    "h-10 px-3 leading-none bg-[#111111] text-[#f5d400] hover:bg-black";

  if (stage === "draft") {
    return (
      <Button
        type="button"
        className={btn}
        disabled={pending}
        onClick={() =>
          run(async () => {
            const a = await approveInvoiceAction({ invoice_id: inv.id });
            if (!a.success) toast.error(a.error.message);
            else
              toast.success(
                inv.kind === "interim"
                  ? "Interim approved — hire stays open"
                  : "Approved — next: send invoice email to customer",
              );
          })
        }
      >
        Approve
      </Button>
    );
  }

  if (stage === "send") {
    return (
      <Button
        type="button"
        className={btn}
        disabled={pending}
        onClick={() =>
          run(async () => {
            const r = await markInvoiceSentAction(inv.id);
            if (!r.success) toast.error(r.error.message);
            else {
              toast.success("Invoice send prepared");
              window.location.href = r.data.mailto;
            }
          })
        }
      >
        Send invoice email
      </Button>
    );
  }

  if (stage === "collect" || stage === "overdue") {
    return (
      <Button
        type="button"
        className={cn(
          "h-10 px-3 leading-none",
          stage === "overdue"
            ? "bg-[#b42318] text-white hover:bg-[#8f1d14]"
            : "bg-[#111111] text-[#f5d400] hover:bg-black",
        )}
        disabled={pending}
        onClick={() =>
          run(async () => {
            const r = await markInvoicePaidAction({ invoice_id: inv.id });
            if (!r.success) toast.error(r.error.message);
            else toast.success("Payment recorded");
          })
        }
      >
        Mark paid
      </Button>
    );
  }

  if (stage === "xero") {
    return (
      <Button
        type="button"
        className={btn}
        disabled={pending}
        onClick={() =>
          run(async () => {
            const r = await markInvoiceAccountingSyncedAction(inv.id);
            if (!r.success) toast.error(r.error.message);
            else toast.success("Marked as entered in Xero");
          })
        }
      >
        Mark entered in Xero
      </Button>
    );
  }

  return null;
}

function DraftLinesEditor({
  inv,
  pending,
  run,
}: {
  inv: InvoiceView;
  pending: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const editableLines = inv.lines.filter((l) => l.kind !== "discount");
  const [units, setUnits] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      editableLines.map((l) => [l.id, String(l.unit_amount)]),
    ),
  );
  const [addDesc, setAddDesc] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addKind, setAddKind] = useState<"other" | "damage" | "fuel">("other");
  const [discount, setDiscount] = useState(String(inv.discount_amount));
  const [notes, setNotes] = useState(inv.notes ?? "");

  useEffect(() => {
    setUnits(
      Object.fromEntries(
        inv.lines
          .filter((l) => l.kind !== "discount")
          .map((l) => [l.id, String(l.unit_amount)]),
      ),
    );
    setDiscount(String(inv.discount_amount));
    setNotes(inv.notes ?? "");
  }, [inv.id, inv.discount_amount, inv.notes, inv.lines]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Edit unit amounts or add a charge. Existing lines cannot be removed.
        Use <span className="font-medium text-foreground">Approve</span> above
        when ready to send.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead className="w-16">Qty</TableHead>
            <TableHead className="w-28">Unit (AUD)</TableHead>
            <TableHead className="w-24">Total</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {editableLines.map((l) => {
            const unitVal = Number(units[l.id] ?? l.unit_amount);
            const preview = Number.isFinite(unitVal)
              ? unitVal * l.quantity
              : l.line_total;
            return (
              <TableRow key={l.id}>
                <TableCell>
                  <span className="text-xs uppercase text-muted-foreground">
                    {l.kind}
                  </span>
                  <br />
                  {l.description}
                </TableCell>
                <TableCell>{l.quantity}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-9"
                    value={units[l.id] ?? String(l.unit_amount)}
                    onChange={(e) =>
                      setUnits((prev) => ({
                        ...prev,
                        [l.id]: e.target.value,
                      }))
                    }
                  />
                </TableCell>
                <TableCell className="tabular-nums">
                  {preview.toFixed(2)}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const amount = Number(units[l.id]);
                        if (!Number.isFinite(amount)) {
                          toast.error("Enter a valid unit amount");
                          return;
                        }
                        const r = await updateDraftInvoiceLineAction({
                          line_id: l.id,
                          unit_amount: amount,
                        });
                        if (!r.success) toast.error(r.error.message);
                        else toast.success("Line amount updated");
                      })
                    }
                  >
                    Save
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="rounded-lg border bg-[#fafafa] p-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Add charge line
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label className="text-xs">Type</Label>
            <select
              className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
              value={addKind}
              onChange={(e) =>
                setAddKind(e.target.value as "other" | "damage" | "fuel")
              }
            >
              <option value="other">Other / fee</option>
              <option value="damage">Damage</option>
              <option value="fuel">Fuel</option>
            </select>
          </div>
          <div className="grid min-w-[12rem] flex-1 gap-1">
            <Label className="text-xs">Description</Label>
            <Input
              className="h-9"
              value={addDesc}
              onChange={(e) => setAddDesc(e.target.value)}
              placeholder="e.g. Site call-out"
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Amount (AUD)</Label>
            <Input
              type="number"
              step="0.01"
              className="h-9 w-28"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="h-9 bg-[#f5d400] text-[#111111] hover:bg-[#e6c600]"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const amount = Number(addAmount);
                if (!addDesc.trim() || !Number.isFinite(amount)) {
                  toast.error("Description and amount required");
                  return;
                }
                const r = await addDraftInvoiceLineAction({
                  invoice_id: inv.id,
                  kind: addKind,
                  description: addDesc.trim(),
                  quantity: 1,
                  unit_amount: amount,
                });
                if (!r.success) toast.error(r.error.message);
                else {
                  toast.success("Line added");
                  setAddDesc("");
                  setAddAmount("");
                }
              })
            }
          >
            Add line
          </Button>
        </div>
      </div>

      <div className="text-sm">
        <p>Subtotal: {money(inv.subtotal)}</p>
        <p>GST: {money(inv.gst_amount)}</p>
        <p>Discount: {money(inv.discount_amount)}</p>
        {inv.deposit_applied > 0 ? (
          <p>Deposit applied: {money(inv.deposit_applied)}</p>
        ) : null}
        <p className="text-base font-semibold">Total: {money(inv.total)}</p>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
        <p className="w-full text-xs text-muted-foreground">
          Optional manager discount (saved separately from Approve).
        </p>
        <div className="grid gap-1">
          <Label htmlFor={`disc-${inv.id}`} className="text-xs">
            Discount (AUD)
          </Label>
          <Input
            id={`disc-${inv.id}`}
            type="number"
            step="0.01"
            className="h-9 w-28"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
        <div className="grid min-w-[10rem] flex-1 gap-1">
          <Label htmlFor={`notes-${inv.id}`} className="text-xs">
            Notes
          </Label>
          <Input
            id={`notes-${inv.id}`}
            className="h-9"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const amount = Number(discount);
              if (!Number.isFinite(amount) || amount < 0) {
                toast.error("Enter a valid discount");
                return;
              }
              const d = await applyDiscountAction({
                invoice_id: inv.id,
                discount_amount: amount,
                notes,
              });
              if (!d.success) toast.error(d.error.message);
              else toast.success("Discount saved — click Approve when ready");
            })
          }
        >
          Save discount
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createRepairWorkOrderAction,
  updateWorkOrderAction,
} from "@/features/operations/actions";
import type { WorkOrderRow } from "@/features/operations/components/maintenance-table";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateAu } from "@/lib/format-date";

type AssetOpt = { id: string; label: string; status?: string };

type RepairRow = WorkOrderRow & { description?: string };

const FILTERS = [
  { id: "all", label: "All open" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In progress" },
  { id: "waiting_parts", label: "Waiting parts" },
] as const;

const ISSUE_TEMPLATES = [
  {
    title: "Hydraulic leak",
    notes: "Locate source, contain fluid, assess hose/cylinder.",
  },
  {
    title: "Engine service",
    notes: "Oil, filters, belts — log hours at intake.",
  },
  {
    title: "Electrical fault",
    notes: "Symptoms, codes if any, battery/alternator check.",
  },
  {
    title: "Boom / structural damage",
    notes: "Photo damage zones; quarantine until inspected.",
  },
  {
    title: "Track / tyre wear",
    notes: "Measure wear; note site conditions.",
  },
  {
    title: "Preventive maintenance",
    notes: "Scheduled PM per manufacturer interval.",
  },
  {
    title: "Return damage — repair",
    notes: "From return QC. Confirm fee estimate with Finance if customer-billable.",
  },
] as const;

export function RepairBay({
  openOrders,
  assets,
}: {
  openOrders: RepairRow[];
  assets: AssetOpt[];
}) {
  const [pending, start] = useTransition();
  const [assetId, setAssetId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [q, setQ] = useState("");

  const sortedAssets = useMemo(() => {
    const rank = (status?: string) =>
      status === "available" ? 0 : status === "in_inspection" ? 1 : 2;
    return [...assets].sort((a, b) => {
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      return a.label.localeCompare(b.label);
    });
  }, [assets]);

  const counts = useMemo(() => {
    const active = openOrders.filter((o) => o.status !== "completed");
    return {
      all: active.length,
      open: active.filter((o) => o.status === "open").length,
      in_progress: active.filter((o) => o.status === "in_progress").length,
      waiting_parts: active.filter((o) => o.status === "waiting_parts").length,
    };
  }, [openOrders]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return openOrders
      .filter((o) => o.status !== "completed")
      .filter((o) => (filter === "all" ? true : o.status === filter))
      .filter((o) => {
        if (!needle) return true;
        return (
          o.serial_number.toLowerCase().includes(needle) ||
          o.title.toLowerCase().includes(needle) ||
          o.catalog_name.toLowerCase().includes(needle) ||
          (o.description?.toLowerCase().includes(needle) ?? false)
        );
      });
  }, [openOrders, filter, q]);

  function setStatus(id: string, status: string, okMsg: string) {
    start(async () => {
      const r = await updateWorkOrderAction({ id, status });
      if (!r.success) toast.error(r.error.message);
      else toast.success(okMsg);
    });
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-display text-2xl font-semibold">Repair bay</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Workshop queue for broken or PM units. Opening a WO puts the asset into{" "}
          <span className="font-medium text-foreground">maintenance</span>{" "}
          (blocked from hire). Completing it returns the unit to{" "}
          <span className="font-medium text-foreground">available</span>. Super
          Admin can also manage these under Maintenance.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            { key: "open", label: "Open", hint: "Not started" },
            { key: "in_progress", label: "In progress", hint: "On the tools" },
            {
              key: "waiting_parts",
              label: "Waiting parts",
              hint: "Blocked on supply",
            },
          ] as const
        ).map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-colors",
              filter === c.key
                ? "border-[#111111] bg-[#111111] text-[#f5d400]"
                : "border-[#e4e4e7] bg-white hover:border-[#111111]/40",
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              {c.label}
            </p>
            <p className="font-display text-3xl font-semibold tabular-nums">
              {counts[c.key]}
            </p>
            <p
              className={cn(
                "text-[11px]",
                filter === c.key ? "text-[#f5d400]/80" : "text-muted-foreground",
              )}
            >
              {c.hint}
            </p>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">
                Open repair jobs{" "}
                <span className="tabular-nums text-muted-foreground">
                  ({visible.length})
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Start work, park on parts, or complete to release the serial.
              </p>
            </div>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter serial or issue…"
              className="h-10 max-w-xs"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  filter === f.id
                    ? "border-[#111111] bg-[#111111] text-[#f5d400]"
                    : "border-[#e4e4e7] bg-white text-foreground hover:border-[#111111]",
                )}
              >
                {f.label}
                <span className="ml-1 tabular-nums opacity-70">
                  ({f.id === "all" ? counts.all : counts[f.id]})
                </span>
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#d4d4d8] px-4 py-8 text-center text-sm text-muted-foreground">
              {counts.all === 0
                ? "No open repair work orders. Intake a unit on the right, or finish return QC with damage flagged."
                : "No jobs match this filter / search."}
            </p>
          ) : (
            <div className="space-y-3">
              {visible.map((row) => (
                <article
                  key={row.id}
                  className="rounded-xl border-2 border-[#111111]/10 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-mono text-lg font-semibold">
                        {row.serial_number}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {row.catalog_name}
                      </p>
                    </div>
                    <StatusPill status={row.status} />
                  </div>
                  <p className="mt-2 font-medium">{row.title}</p>
                  {row.description?.trim() ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {row.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Due {row.due_at ? formatDateAu(row.due_at) : "—"}
                    {row.estimated_hours
                      ? ` · Est. ${row.estimated_hours}h`
                      : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.status === "open" ? (
                      <Button
                        size="sm"
                        className="h-10 bg-[#111111] text-[#f5d400] hover:bg-black"
                        disabled={pending}
                        onClick={() =>
                          setStatus(row.id, "in_progress", "In progress")
                        }
                      >
                        Start
                      </Button>
                    ) : null}
                    {row.status === "in_progress" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10"
                        disabled={pending}
                        onClick={() =>
                          setStatus(
                            row.id,
                            "waiting_parts",
                            "Waiting on parts",
                          )
                        }
                      >
                        Waiting parts
                      </Button>
                    ) : null}
                    {row.status === "waiting_parts" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10"
                        disabled={pending}
                        onClick={() =>
                          setStatus(row.id, "in_progress", "Back in progress")
                        }
                      >
                        Resume
                      </Button>
                    ) : null}
                    {row.status !== "completed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-10"
                        disabled={pending}
                        onClick={() =>
                          setStatus(
                            row.id,
                            "completed",
                            "Repaired. Asset available for hire",
                          )
                        }
                      >
                        Complete → available
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-20">
          <form
            className="space-y-3 rounded-xl border border-[#e4e4e7] bg-white p-4 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const result = await createRepairWorkOrderAction({
                  asset_id: assetId,
                  title,
                  description,
                });
                if (!result.success) toast.error(result.error.message);
                else {
                  toast.success("Repair WO opened. Asset in maintenance");
                  setTitle("");
                  setDescription("");
                  setAssetId("");
                }
              });
            }}
          >
            <div>
              <h3 className="font-display text-lg font-semibold">
                Intake for repair
              </h3>
              <p className="text-xs text-muted-foreground">
                Yard damage, PM, or customer damage. Serial leaves the hire pool
                until Complete.
              </p>
            </div>
            <div className="grid gap-1">
              <Label>Asset</Label>
              <select
                required
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="h-11 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">Select serial…</option>
                {sortedAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.status && !a.label.includes(`(${a.status})`)
                      ? `${a.label} (${a.status})`
                      : a.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label>Issue</Label>
              <div className="mb-1.5 flex flex-wrap gap-1">
                {ISSUE_TEMPLATES.map((t) => (
                  <button
                    key={t.title}
                    type="button"
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                      title === t.title
                        ? "border-[#111111] bg-[#f5d400]/40"
                        : "border-[#e4e4e7] bg-white hover:border-[#111111]",
                    )}
                    onClick={() => {
                      setTitle(t.title);
                      setDescription((prev) => (prev.trim() ? prev : t.notes));
                    }}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
              <Input
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short issue title"
              />
            </div>
            <div className="grid gap-1">
              <Label>Notes</Label>
              <Textarea
                className="min-h-24"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Symptoms, safety holds, parts needed…"
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full bg-[#f5d400] text-[#111111] hover:bg-[#e6c600]"
              disabled={pending}
            >
              Open repair WO
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
}

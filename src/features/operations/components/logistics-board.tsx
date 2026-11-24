"use client";

import { useMemo, useState, useTransition } from "react";
import { updateDeliveryTaskAction } from "@/features/operations/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatDateTimeAu } from "@/lib/format-date";

export type DeliveryRow = {
  id: string;
  task_type: string;
  status: string;
  scheduled_at: string;
  address: string;
  driver_notes: string;
  order_number: string;
  company_name: string;
  pod_signed_by?: string;
  pod_notes?: string;
};

export function LogisticsBoard({ rows }: { rows: DeliveryRow[] }) {
  const [pending, start] = useTransition();
  const [typeFilter, setTypeFilter] = useState<"all" | "delivery" | "pickup">(
    "all",
  );
  const [podTaskId, setPodTaskId] = useState<string | null>(null);

  function setStatus(id: string, status: DeliveryRow["status"]) {
    start(async () => {
      const result = await updateDeliveryTaskAction({ id, status });
      if (!result.success) toast.error(result.error.message);
      else toast.success(`Task → ${status}`);
    });
  }

  const filtered = useMemo(() => {
    if (typeFilter === "all") return rows;
    return rows.filter((r) => r.task_type === typeFilter);
  }, [rows, typeFilter]);

  const columns = ["scheduled", "en_route", "completed"] as const;
  const podRow = filtered.find((r) => r.id === podTaskId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", "All"],
            ["delivery", "Deliveries"],
            ["pickup", "Pickups"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTypeFilter(id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              typeFilter === id
                ? "bg-[#111111] text-[#f5d400]"
                : "bg-[#f4f4f5] text-muted-foreground hover:bg-[#e4e4e7]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:[&>*]:min-w-0">
        {columns.map((col) => {
          const colRows = filtered.filter((r) => r.status === col);
          return (
            <section
              key={col}
              className="min-w-0 space-y-2"
            >
              <h3
                className={`text-sm font-semibold capitalize ${
                  col === "en_route" ? "text-[#111111]" : ""
                }`}
              >
                {col.replace("_", " ")}
                <span className="ml-2 text-muted-foreground">
                  ({colRows.length})
                </span>
              </h3>
              {colRows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#d4d4d8] px-3 py-6 text-sm text-muted-foreground">
                  Nothing {col.replace("_", " ")}
                </p>
              ) : (
                colRows.map((row) => (
                  <article
                    key={row.id}
                    className={`space-y-2 rounded-xl border bg-white p-4 ${
                      col === "en_route"
                        ? "border-[#111111] shadow-sm"
                        : "border-[#d4d4d8]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display text-base font-semibold">
                        {row.order_number}
                      </h4>
                      <Badge variant="outline">{row.task_type}</Badge>
                    </div>
                    <p className="font-medium">{row.company_name}</p>
                    <p className="text-sm text-muted-foreground">{row.address}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeAu(row.scheduled_at)}
                    </p>
                    {row.driver_notes ? (
                      <p className="text-xs">{row.driver_notes}</p>
                    ) : null}
                    {col === "completed" && row.pod_signed_by ? (
                      <p className="rounded-md bg-[#f5d400]/20 px-2 py-1.5 text-xs text-[#111111]">
                        Signed by {row.pod_signed_by}
                        {row.pod_notes ? ` — ${row.pod_notes}` : ""}
                      </p>
                    ) : null}
                    {col === "scheduled" ? (
                      <Button
                        className="h-11 w-full bg-[#111111] text-[#f5d400] hover:bg-black"
                        disabled={pending}
                        onClick={() => setStatus(row.id, "en_route")}
                      >
                        En route
                      </Button>
                    ) : null}
                    {col === "en_route" ? (
                      <Button
                        className="h-11 w-full bg-[#f5d400] text-[#111111] hover:bg-[#e6c600]"
                        disabled={pending}
                        onClick={() => setPodTaskId(row.id)}
                      >
                        Complete with signature
                      </Button>
                    ) : null}
                  </article>
                ))
              )}
            </section>
          );
        })}
      </div>

      {podRow ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pod-title"
          onClick={() => setPodTaskId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pod-title" className="font-display text-lg font-semibold">
              Proof of delivery
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {podRow.order_number} · {podRow.company_name}
            </p>
            <PodCompleteForm
              id={podRow.id}
              pending={pending}
              start={start}
              onDone={() => setPodTaskId(null)}
              onCancel={() => setPodTaskId(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PodCompleteForm({
  id,
  pending,
  start,
  onDone,
  onCancel,
}: {
  id: string;
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [signedBy, setSignedBy] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="mt-3 space-y-2">
      <div className="grid gap-1">
        <Label className="text-xs">Who signed / received?</Label>
        <Input
          value={signedBy}
          onChange={(e) => setSignedBy(e.target.value)}
          placeholder="Site contact name"
          className="h-11 text-base"
          autoFocus
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="min-h-[72px] text-base"
          placeholder="Left at gate / photo on phone…"
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="bg-[#f5d400] text-[#111111] hover:bg-[#e6c600]"
          disabled={pending || !signedBy.trim()}
          onClick={() =>
            start(async () => {
              const result = await updateDeliveryTaskAction({
                id,
                status: "completed",
                pod_signed_by: signedBy.trim(),
                pod_notes: notes.trim(),
              });
              if (!result.success) toast.error(result.error.message);
              else {
                toast.success("Delivery completed with signature");
                onDone();
              }
            })
          }
        >
          Complete with signature
        </Button>
      </div>
    </div>
  );
}

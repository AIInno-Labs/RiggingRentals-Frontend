"use client";

import { useMemo, useState } from "react";
import {
  TurnaroundList,
  WorkshopJobsTable,
  type AssetOption,
  type WorkshopOrder,
} from "@/features/workshop/components/workshop-job-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export type WorkshopTab = "dispatch" | "on_rent" | "returns";

function resolveTab(raw?: string): WorkshopTab {
  if (raw === "on_rent") return "on_rent";
  if (raw === "returns" || raw === "return") return "returns";
  return "dispatch";
}

export function WorkshopFloor({
  pickOrders,
  onRentOrders,
  returnOrders,
  turnaround,
  defaultTab,
  searchQuery = "",
  canRevertDispatch = false,
}: {
  pickOrders: WorkshopOrder[];
  onRentOrders: WorkshopOrder[];
  returnOrders: WorkshopOrder[];
  turnaround: AssetOption[];
  defaultTab?: string;
  searchQuery?: string;
  canRevertDispatch?: boolean;
}) {
  const initial = useMemo(() => resolveTab(defaultTab), [defaultTab]);
  const [tab, setTab] = useState<WorkshopTab>(initial);
  const q = searchQuery.trim().toLowerCase();

  const turnaroundForDisplay = useMemo(() => {
    if (!q) return turnaround;
    return turnaround.filter((a) => {
      if (a.status !== "in_inspection") return true;
      return (
        a.serial_number.toLowerCase().includes(q) ||
        (a.catalog_label?.toLowerCase().includes(q) ?? false) ||
        (a.last_order_number?.toLowerCase().includes(q) ?? false) ||
        (a.last_client_name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [turnaround, q]);

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(resolveTab(v))}
        className="gap-4"
      >
        <TabsList className="steel-panel h-auto w-full grid grid-cols-3 gap-1 rounded-xl p-1">
          <TabsTrigger
            value="dispatch"
            className="font-display data-active:bg-[#111111] data-active:text-[#f5d400]"
          >
            Dispatch
            {pickOrders.length > 0 ? (
              <span className="tabular-nums opacity-70">({pickOrders.length})</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger
            value="on_rent"
            className="font-display data-active:bg-[#111111] data-active:text-[#f5d400]"
          >
            On rent
            {onRentOrders.length > 0 ? (
              <span className="tabular-nums opacity-70">({onRentOrders.length})</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger
            value="returns"
            className="font-display data-active:bg-[#111111] data-active:text-[#f5d400]"
          >
            Returns
            {returnOrders.length > 0 ? (
              <span className="tabular-nums opacity-70">({returnOrders.length})</span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dispatch" className="space-y-3">
          <section
            aria-labelledby="pick-dispatch-heading"
            className="space-y-3"
          >
            <div>
              <h3
                id="pick-dispatch-heading"
                className="font-display text-base font-semibold text-[#111111]"
              >
                Pick &amp; dispatch
              </h3>
              <p className="text-xs text-muted-foreground">
                Assign RRP units, check certs, then dispatch.
              </p>
            </div>
            <Card>
              <CardContent className="pt-4">
                <WorkshopJobsTable
                  orders={pickOrders}
                  assets={turnaround}
                  canRevertDispatch={canRevertDispatch}
                  emptyHint="No jobs waiting to pick. Confirmed hires appear here after sales locks stock."
                />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="on_rent" className="space-y-3">
          <section aria-labelledby="on-rent-heading" className="space-y-3">
            <div>
              <h3
                id="on-rent-heading"
                className="font-display text-base font-semibold text-[#111111]"
              >
                On rent
              </h3>
              <p className="text-xs text-muted-foreground">
                Record off-hire when the customer stops hire.
              </p>
            </div>
            <Card>
              <CardContent className="pt-4">
                <WorkshopJobsTable
                  orders={onRentOrders}
                  assets={turnaround}
                  canRevertDispatch={canRevertDispatch}
                  emptyHint="No hires currently on rent."
                />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="returns" className="space-y-3">
          <section aria-labelledby="returns-heading" className="space-y-3">
            <div>
              <h3
                id="returns-heading"
                className="font-display text-base font-semibold text-[#111111]"
              >
                Returns waiting for QC
              </h3>
              <p className="text-xs text-muted-foreground">
                Complete return QC on each RRP unit.
              </p>
            </div>
            <Card>
              <CardContent className="pt-4">
                <WorkshopJobsTable
                  orders={returnOrders}
                  assets={turnaround}
                  canRevertDispatch={canRevertDispatch}
                  emptyHint="No returns waiting for QC."
                />
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>

      <TurnaroundList assets={turnaroundForDisplay} />
    </div>
  );
}

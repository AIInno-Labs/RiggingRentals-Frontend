"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { DonutChart } from "@/components/donut-chart";
import type {
  DonutSliceData,
  OpsAlert,
  RecentOrder,
} from "@/features/dashboard/get-fleet-kpis";
import type { FollowUpItem } from "@/features/dashboard/get-follow-ups";
import type { OpsAnalytics } from "@/features/dashboard/get-ops-analytics";
import type { HirePressureRow } from "@/features/dashboard/get-hire-pressure";
import { OpsAttentionQueue } from "@/features/dashboard/components/ops-attention-queue";
import { BrandBarChart } from "@/features/dashboard/components/charts/brand-bar-chart";
import { BrandPieChart } from "@/features/dashboard/components/charts/brand-pie-chart";
import { BrandScatterChart } from "@/features/dashboard/components/charts/brand-scatter-chart";
import { ChartLegend } from "@/features/dashboard/components/charts/chart-legend";
import { RankedBarList } from "@/features/dashboard/components/charts/ranked-bar-list";
import { CHART } from "@/features/dashboard/components/charts/theme";
import { StatusPill } from "@/components/status-pill";
import { cn } from "@/lib/utils";

const FLEET_HREF: Record<string, string> = {
  onHire: "/admin/catalog?status=on_hire",
  reserved: "/admin/catalog?status=reserved",
  available: "/admin/catalog?status=available",
  inspection: "/admin/catalog?status=in_inspection",
  maintenance: "/admin/catalog?status=maintenance",
};

const PIPELINE_HREF: Record<string, string> = {
  pending: "/admin/pipeline?status=draft",
  rented: "/admin/pipeline?status=dispatched",
  returned: "/admin/pipeline?status=returned",
  invoiced: "/admin/pipeline?status=invoiced",
};

function money(n: number): string {
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

/** Monday-start week key YYYY-MM-DD (UTC date parts). */
function mondayOf(d: Date): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** Fill last N Mon–Sun weeks so the revenue chart always shows a continuous X axis. */
function fillLastRevenueWeeks(
  rows: { label: string; week_start: string; total: number }[],
  weekCount = 6,
): {
  label: string;
  dateLabel: string;
  week_start: string;
  total: number;
}[] {
  const byStart = new Map<string, number>();
  for (const r of rows) {
    const raw = r.week_start.slice(0, 10);
    const key = isoDate(mondayOf(new Date(`${raw}T12:00:00Z`)));
    byStart.set(key, (byStart.get(key) ?? 0) + r.total);
  }
  const end = mondayOf(new Date());
  const out: {
    label: string;
    dateLabel: string;
    week_start: string;
    total: number;
  }[] = [];
  for (let i = weekCount - 1; i >= 0; i--) {
    const w = new Date(end);
    w.setUTCDate(end.getUTCDate() - i * 7);
    const key = isoDate(w);
    const weekNum = weekCount - i;
    out.push({
      week_start: key,
      label: `Week ${weekNum}`,
      dateLabel: weekLabel(w),
      total: byStart.get(key) ?? 0,
    });
  }
  return out;
}

function openedOnFromDaysOpen(daysOpen: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - Math.max(0, daysOpen));
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Open WOs by Monday week — fill continuous last N weeks from RPC aggregates. */
function fillLastShopOpenWeeks(
  rows: { label: string; week_start: string; total: number }[],
  weekCount = 4,
): {
  label: string;
  dateLabel: string;
  week_start: string;
  count: number;
}[] {
  const byStart = new Map<string, number>();
  for (const r of rows) {
    const raw = r.week_start.slice(0, 10);
    const key = isoDate(mondayOf(new Date(`${raw}T12:00:00Z`)));
    byStart.set(key, (byStart.get(key) ?? 0) + r.total);
  }
  const end = mondayOf(new Date());
  const out: {
    label: string;
    dateLabel: string;
    week_start: string;
    count: number;
  }[] = [];
  for (let i = weekCount - 1; i >= 0; i--) {
    const w = new Date(end);
    w.setUTCDate(end.getUTCDate() - i * 7);
    const key = isoDate(w);
    const weekNum = weekCount - i;
    out.push({
      week_start: key,
      label: `Week ${weekNum}`,
      dateLabel: weekLabel(w),
      count: byStart.get(key) ?? 0,
    });
  }
  return out;
}

function PulseTile({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
  tone?: "default" | "alert" | "warn";
}) {
  return (
    <Link
      href={href}
      prefetch
      className={cn(
        "group rounded-2xl border bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-[#f5d400]/70 hover:shadow-md sm:p-4",
        tone === "alert" && "border-[#b42318]/30",
        tone === "warn" && "border-[#f5d400]/50",
        tone === "default" && "border-[#e4e4e7]",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground group-hover:text-foreground">
        {hint}
      </p>
    </Link>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  href,
  kpi,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  href?: string;
  kpi?: string;
}) {
  return (
    <div className="anim-rise steel-panel flex flex-col rounded-2xl p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h4 className="font-display text-lg font-semibold">{title}</h4>
            {kpi ? (
              <span className="text-sm font-semibold tabular-nums text-foreground">
                {kpi}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {href ? (
          <Link
            href={href}
            prefetch
            className="brand-link shrink-0 text-xs font-medium"
          >
            Open
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function OpsCommandCenter({
  analytics,
  alerts,
  followUps,
  fleetDonut,
  pipelineDonut,
  recentOrders,
  hirePressure,
}: {
  analytics: OpsAnalytics;
  alerts: OpsAlert[];
  followUps: FollowUpItem[];
  fleetDonut: DonutSliceData[];
  pipelineDonut: DonutSliceData[];
  recentOrders: RecentOrder[];
  hirePressure: HirePressureRow[];
}) {
  const { pulse } = analytics;
  const arTone =
    pulse.arAtRisk > 0 ? "alert" : pulse.draftInvoices > 0 ? "warn" : "default";
  const criticalTone = pulse.criticalBlockers > 0 ? "alert" : "default";
  const shopTone = pulse.shopStuck7d > 0 ? "warn" : "default";

  const maxBilled = Math.max(1, ...analytics.topClients.map((c) => c.billed));
  const topCustomers = analytics.topClients.slice(0, 6);
  const topCustomersTotal = topCustomers.reduce((s, c) => s + c.billed, 0);
  const revenueWeeks = fillLastRevenueWeeks(analytics.revenueByWeek, 6);
  const revenue6w = revenueWeeks.reduce((s, w) => s + w.total, 0);
  const revenueRangeLabel =
    revenueWeeks.length > 0
      ? `last 6 weeks · ${revenueWeeks[0]!.dateLabel} → ${revenueWeeks[revenueWeeks.length - 1]!.dateLabel}`
      : "last 6 weeks";
  const invoiceTotal = analytics.invoiceStatus.reduce((s, r) => s + r.value, 0);
  const shopOpenWeeks = fillLastShopOpenWeeks(analytics.shopOpenedByWeek, 4);
  const shopTotal = shopOpenWeeks.reduce((s, w) => s + w.count, 0);
  const shopRangeLabel =
    shopOpenWeeks.length > 0
      ? `last 4 weeks · ${shopOpenWeeks[0]!.dateLabel} → ${shopOpenWeeks[shopOpenWeeks.length - 1]!.dateLabel}`
      : "last 4 weeks";
  const shopAgingSample = analytics.shopAgingRows.slice(0, 5);
  const scatterTop = [...analytics.demandScatter]
    .sort((a, b) => b.x - a.x)
    .slice(0, 5);
  const pressureShort = hirePressure.filter((r) => r.shortfall > 0).length;
  const fromDay = new Date();
  const toDay = new Date();
  toDay.setUTCDate(toDay.getUTCDate() + 13);
  const pressureHref = `/admin/availability?from=${fromDay.toISOString().slice(0, 10)}&to=${toDay.toISOString().slice(0, 10)}`;

  return (
    <div className="space-y-5">
      {analytics.loadError ? (
        <p
          className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          role="status"
        >
          Live analytics could not load. Charts below may be empty. Refresh to
          retry.
        </p>
      ) : null}
      <section className="anim-rise steel-panel rounded-2xl p-4 md:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Today</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight">
              Command center
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              See blockers first. Trends below help you decide where to push.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/admin/pipeline" prefetch className="brand-link font-medium">
              Orders
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/workshop" prefetch className="brand-link font-medium">
              Workshop
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/admin/logistics" prefetch className="brand-link font-medium">
              Logistics
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/billing" prefetch className="brand-link font-medium">
              Billing
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <PulseTile
            label="Critical blockers"
            value={String(pulse.criticalBlockers)}
            hint="Expired certificates. Open catalog"
            href="/admin/catalog?cert=expired"
            tone={criticalTone}
          />
          <PulseTile
            label="Shop stuck 7d+"
            value={String(pulse.shopStuck7d)}
            hint="Shop stuck 7 day plus"
            href="/workshop/repairs?aging=7d"
            tone={shopTone}
          />
          <PulseTile
            label="AR at risk"
            value={String(pulse.arAtRisk)}
            hint="Approved unpaid past due"
            href="/billing?stage=overdue"
            tone={arTone}
          />
          <PulseTile
            label="Fleet on hire"
            value={String(pulse.fleetOnHire)}
            hint={`${pulse.utilizationPct}% util · ${pulse.available} free`}
            href="/admin/catalog?status=on_hire"
          />
          <PulseTile
            label="Orders open"
            value={String(pulse.pipelineOpen)}
            hint="Draft quotes + returned awaiting invoice"
            href="/admin/pipeline"
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-display text-xl font-semibold">Insights</h3>
          <p className="text-sm text-muted-foreground">
            Fleet, cash, demand, and shop stuck 7 day plus. Click through to act.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <DonutChart
            title="Fleet composition"
            subtitle={`${pulse.totalAssets} active assets`}
            slices={fleetDonut}
            hrefByKey={FLEET_HREF}
          />
          <DonutChart
            title="Hire pipeline"
            subtitle="Quotes through invoiced"
            slices={pipelineDonut}
            hrefByKey={PIPELINE_HREF}
          />

          <ChartCard
            title="Billed revenue"
            subtitle={`Approved invoices · ${revenueRangeLabel} · AUD`}
            href="/billing"
            kpi={money(revenue6w)}
          >
            <BrandBarChart
              data={revenueWeeks.map((w) => ({
                label: w.label,
                total: w.total,
                period: w.dateLabel,
              }))}
              xKey="label"
              yKey="total"
              formatY={(n) =>
                n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `$${n}`
              }
              footerNote={`Week 1 = ${revenueWeeks[0]?.dateLabel ?? "—"} (oldest) · Week ${revenueWeeks.length} = ${revenueWeeks[revenueWeeks.length - 1]?.dateLabel ?? "—"} (current) · Y = AUD billed`}
            />
          </ChartCard>

          <ChartCard
            title="Invoice mix"
            subtitle="Draft · unpaid · paid"
            href="/billing"
            kpi={`${invoiceTotal} invoices`}
          >
            <BrandPieChart data={analytics.invoiceStatus} />
            <ChartLegend
              items={analytics.invoiceStatus.map((s, i) => ({
                color: CHART.palette[i % CHART.palette.length]!,
                label: s.name,
                value: s.value,
              }))}
            />
          </ChartCard>

          <ChartCard
            title="Demand vs downtime"
            subtitle="Each dot = equipment type · hire pressure vs shop load"
            href="/workshop/repairs"
          >
            <BrandScatterChart data={analytics.demandScatter} />
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              Right = more hire days (90d). Up = more open shop days. Larger
              dots = more assets on that type.
            </p>
            {scatterTop.length > 0 ? (
              <div className="mt-2 overflow-x-auto rounded-lg border border-[#e4e4e7]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-[#fafafa] text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-1.5 font-medium">SKU / type</th>
                      <th className="px-2 py-1.5 font-medium">Hire days</th>
                      <th className="px-2 py-1.5 font-medium">Down days</th>
                      <th className="px-2 py-1.5 font-medium">Assets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scatterTop.map((p) => (
                      <tr
                        key={p.name}
                        className="border-b border-[#f4f4f5] last:border-0"
                      >
                        <td className="max-w-[10rem] truncate px-2 py-1.5 font-medium">
                          {p.name}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{p.x}</td>
                        <td className="px-2 py-1.5 tabular-nums">{p.y}</td>
                        <td className="px-2 py-1.5 tabular-nums">
                          {p.z ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </ChartCard>

          <ChartCard
            title="Shop aging"
            subtitle={`Open work orders · when they were raised · ${shopRangeLabel}`}
            href="/workshop/repairs"
            kpi={`${shopTotal} open`}
          >
            <BrandBarChart
              horizontal
              data={[...shopOpenWeeks].reverse().map((w) => ({
                label: w.label,
                open: Number(w.count) || 0,
                period: w.dateLabel,
              }))}
              xKey="label"
              yKey="open"
              yAxisWidth={72}
              formatY={(n) => String(Number.isFinite(n) ? n : 0)}
              footerNote={`Week 1 = ${shopOpenWeeks[0]?.dateLabel ?? "—"} (oldest) · Week ${shopOpenWeeks.length} = ${shopOpenWeeks[shopOpenWeeks.length - 1]?.dateLabel ?? "—"} (current) · bar length = items waiting pickup from client that week`}
            />
            {shopAgingSample.length > 0 ? (
              <div className="mt-3 overflow-x-auto rounded-lg border border-[#e4e4e7]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-[#fafafa] text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-1.5 font-medium">RRP #</th>
                      <th className="px-2 py-1.5 font-medium">Opened</th>
                      <th className="px-2 py-1.5 font-medium">Days open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shopAgingSample.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-[#f4f4f5] last:border-0"
                      >
                        <td className="max-w-[8rem] truncate px-2 py-1.5 font-medium">
                          {r.serial_number}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                          {openedOnFromDaysOpen(r.days_open)}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{r.days_open}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </ChartCard>

          <ChartCard
            title="Top customers"
            subtitle="Highest billed · last 90 days · AUD"
            href="/admin/clients"
            kpi={money(topCustomersTotal)}
          >
            {topCustomers.length === 0 ? (
              <p className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[#d4d4d8] text-sm text-muted-foreground">
                No approved billing in the last 90 days.
              </p>
            ) : (
              <div className="space-y-3">
                {topCustomers[0] ? (
                  <Link
                    href="/admin/clients"
                    prefetch
                    className="block rounded-xl border border-[#f5d400]/70 bg-[linear-gradient(135deg,#fffef5_0%,#ffffff_55%)] px-3 py-3 transition-colors hover:border-[#f5d400]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#71717a]">
                          #1 · Highest revenue
                        </p>
                        <p className="mt-1 truncate font-display text-xl font-semibold tracking-tight text-[#111111]">
                          {topCustomers[0].name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {topCustomers[0].orders} order
                          {topCustomers[0].orders === 1 ? "" : "s"} · last 90
                          days
                        </p>
                      </div>
                      <p className="shrink-0 font-display text-2xl font-semibold tabular-nums tracking-tight text-[#111111]">
                        {money(topCustomers[0].billed)}
                      </p>
                    </div>
                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#f4f4f5]">
                      <span className="block h-full w-full rounded-full bg-[#f5d400]" />
                    </div>
                  </Link>
                ) : null}
                <ol className="space-y-2.5">
                  {topCustomers.slice(1).map((c, idx) => {
                    const rank = idx + 2;
                    const pct = Math.max(
                      6,
                      Math.round((c.billed / maxBilled) * 100),
                    );
                    return (
                      <li key={c.id}>
                        <Link
                          href="/admin/clients"
                          prefetch
                          className="block rounded-lg px-1 py-0.5 transition-colors hover:bg-[#fafafa]"
                        >
                          <div className="mb-1 flex items-baseline justify-between gap-2">
                            <div className="flex min-w-0 items-baseline gap-2">
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#111111] text-[10px] font-semibold text-[#f5d400]">
                                {rank}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {c.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {c.orders} order
                                  {c.orders === 1 ? "" : "s"}
                                </p>
                              </div>
                            </div>
                            <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                              {money(c.billed)}
                            </p>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#f4f4f5]">
                            <span
                              className="block h-full rounded-full bg-[#f5d400]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Ranked by approved invoice total · top {topCustomers.length}{" "}
                  customers
                </p>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Revenue by equipment"
            subtitle="Approved rental lines · 90 days · AUD"
            href="/admin/catalog"
            kpi={money(
              analytics.revenueByCategory.reduce((s, c) => s + c.size, 0),
            )}
          >
            <RankedBarList
              items={analytics.revenueByCategory.slice(0, 8).map((c, i) => ({
                id: `${c.name}-${i}`,
                name: c.name,
                value: c.size,
                valueLabel: money(c.size),
                href: "/admin/catalog",
              }))}
              emptyMessage="No rental revenue in the last 90 days"
            />
          </ChartCard>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="anim-rise steel-panel rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="font-display text-lg font-semibold">
                  High-demand equipment
                </h4>
                <p className="text-xs text-muted-foreground">
                  Hire days · last 90 days
                </p>
              </div>
              <Link
                href="/admin/catalog"
                prefetch
                className="brand-link text-xs font-medium"
              >
                Catalog
              </Link>
            </div>
            {analytics.topEquipment.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#d4d4d8] px-3 py-6 text-center text-sm text-muted-foreground">
                No dispatches in the last 90 days.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 font-medium">SKU</th>
                      <th className="pb-2 font-medium">Days</th>
                      <th className="pb-2 font-medium">Hires</th>
                      <th className="pb-2 text-right font-medium">Rev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topEquipment.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-[#f4f4f5] last:border-0"
                      >
                        <td className="py-2">
                          <Link
                            href="/admin/catalog"
                            className="font-medium hover:underline"
                          >
                            {e.sku}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {e.name}
                          </p>
                        </td>
                        <td className="py-2 tabular-nums">{e.hire_days}</td>
                        <td className="py-2 tabular-nums">{e.hire_events}</td>
                        <td className="py-2 text-right tabular-nums">
                          {money(e.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="anim-rise steel-panel flex flex-col rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="font-display text-lg font-semibold">
                  Stuck in workshop
                </h4>
                <p className="text-xs text-muted-foreground">
                  Oldest items waiting pickup from client first
                </p>
              </div>
              <Link
                href="/workshop/repairs"
                prefetch
                className="brand-link text-xs font-medium"
              >
                Repair bay
              </Link>
            </div>
            {analytics.shopAgingRows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#d4d4d8] px-3 py-6 text-center text-sm text-muted-foreground">
                Shop clear. No items waiting pickup from client.
              </p>
            ) : (
              <>
                <ul className="max-h-64 divide-y divide-[#e4e4e7] overflow-y-auto rounded-xl border border-[#e4e4e7]">
                  {analytics.shopAgingRows.slice(0, 5).map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          <span className="text-xs text-muted-foreground font-normal">RRP</span>{" "}
                          {r.serial_number}{" "}
                          <span className="text-muted-foreground">
                            · {r.sku}
                          </span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.title} · opened {openedOnFromDaysOpen(r.days_open)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                            r.days_open >= 15
                              ? "bg-[#b42318] text-white"
                              : r.days_open >= 8
                                ? "bg-[#111111] text-[#f5d400]"
                                : r.days_open >= 4
                                  ? "bg-[#f5d400] text-[#111111]"
                                  : "bg-[#f4f4f5] text-[#52525b]",
                          )}
                        >
                          {r.days_open}d
                        </span>
                        <Link
                          href={r.href}
                          prefetch
                          className="inline-flex h-8 w-14 items-center justify-center rounded-lg bg-[#111111] text-xs font-semibold text-[#f5d400] hover:bg-black"
                        >
                          Open
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
                {analytics.shopAgingRows.length > 5 ? (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Showing 5 of {analytics.shopAgingRows.length}.{" "}
                    <Link
                      href="/workshop/repairs"
                      className="brand-link font-medium"
                    >
                      View all in Repair bay
                    </Link>
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="anim-rise steel-panel flex flex-col rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h4 className="font-display text-lg font-semibold">
                  Latest movements
                </h4>
                <p className="text-xs text-muted-foreground">
                  Recent order updates
                </p>
              </div>
              <Link
                href="/admin/pipeline"
                prefetch
                className="brand-link text-xs font-medium"
              >
                Orders
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#d4d4d8] px-3 py-6 text-center text-sm text-muted-foreground">
                No recent order activity.
              </p>
            ) : (
              <ul className="max-h-64 divide-y divide-[#e4e4e7] overflow-y-auto">
                {recentOrders.slice(0, 4).map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      prefetch
                      className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-[#fafafa]"
                    >
                      <div className="min-w-0">
                        <p className="font-medium tabular-nums">
                          {o.order_number}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {o.company_name}
                          {o.jobsite_name ? ` · ${o.jobsite_name}` : ""}
                        </p>
                      </div>
                      <StatusPill status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="anim-rise steel-panel flex flex-col rounded-2xl p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h4 className="font-display text-lg font-semibold">
                  Next 14 days hire pressure
                </h4>
                <p className="text-xs text-muted-foreground">
                  Peak booked vs yard capacity
                  {pressureShort > 0
                    ? ` · ${pressureShort} short`
                    : " · no shortfalls"}
                </p>
              </div>
              <Link
                href={pressureHref}
                prefetch
                className="brand-link shrink-0 text-xs font-medium"
              >
                Fleet
              </Link>
            </div>
            {hirePressure.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#d4d4d8] px-3 py-6 text-center text-sm text-muted-foreground">
                No overlapping hires in the next 14 days.
              </p>
            ) : (
              <ul className="max-h-64 divide-y divide-[#e4e4e7] overflow-y-auto rounded-xl border border-[#e4e4e7]">
                {hirePressure.map((r) => {
                  const tight = r.shortfall > 0;
                  const load =
                    r.capacity > 0
                      ? Math.min(100, Math.round((r.peak_booked / r.capacity) * 100))
                      : r.peak_booked > 0
                        ? 100
                        : 0;
                  return (
                    <li key={r.catalog_id}>
                      <Link
                        href={pressureHref}
                        prefetch
                        className="block px-3 py-2.5 transition-colors hover:bg-[#fafafa]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {r.sku}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {r.name}
                            </p>
                          </div>
                          {tight ? (
                            <span className="shrink-0 rounded-full bg-[#b42318]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#b42318]">
                              {r.shortfall} short
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-[#027a48]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#027a48]">
                              OK
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] tabular-nums text-muted-foreground">
                          <span>
                            Booked {r.peak_booked} · capacity {r.capacity}
                          </span>
                          <span>{load}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f4f4f5]">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              tight ? "bg-[#b42318]" : "bg-[#f5d400]",
                            )}
                            style={{ width: `${Math.max(load, 4)}%` }}
                          />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Quotes, confirmed, and on-hire lines that overlap the next 14 days.
              Short = peak day demand above free fleet.
            </p>
          </div>
        </div>
      </section>

      <OpsAttentionQueue alerts={alerts} followUps={followUps} />
    </div>
  );
}

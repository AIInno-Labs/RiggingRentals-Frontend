import { rentalDb, asNumber } from "@/lib/supabase/rental-db";

export type OpsPulse = {
  criticalBlockers: number;
  shopStuck7d: number;
  arAtRisk: number;
  draftInvoices: number;
  fleetOnHire: number;
  utilizationPct: number;
  pipelineOpen: number;
  available: number;
  totalAssets: number;
};

export type RevenueWeek = { label: string; week_start: string; total: number };
export type NamedCount = { name: string; value?: number; count?: number };
export type TopClient = {
  id: string;
  name: string;
  orders: number;
  billed: number;
};
export type TopEquipment = {
  id: string;
  sku: string;
  name: string;
  hire_events: number;
  hire_days: number;
  revenue: number;
};
export type CategoryRevenue = { name: string; size: number };
export type DemandPoint = {
  name: string;
  x: number;
  y: number;
  z: number;
};
export type ShopAgingBuckets = {
  d0_3: number;
  d4_7: number;
  d8_14: number;
  d15: number;
};
export type ShopAgingRow = {
  id: string;
  serial_number: string;
  sku: string;
  status: string;
  title: string;
  days_open: number;
  href: string;
};

export type OpsAnalytics = {
  pulse: OpsPulse;
  revenueByWeek: RevenueWeek[];
  invoiceStatus: { name: string; value: number }[];
  pipelineBars: { name: string; count: number }[];
  topClients: TopClient[];
  topEquipment: TopEquipment[];
  revenueByCategory: CategoryRevenue[];
  demandScatter: DemandPoint[];
  shopAgingBuckets: ShopAgingBuckets;
  shopOpenedByWeek: RevenueWeek[];
  shopAgingRows: ShopAgingRow[];
  /** Present when the analytics RPC failed — UI can show a soft warning. */
  loadError?: string;
};

function emptyPulse(): OpsPulse {
  return {
    criticalBlockers: 0,
    shopStuck7d: 0,
    arAtRisk: 0,
    draftInvoices: 0,
    fleetOnHire: 0,
    utilizationPct: 0,
    pipelineOpen: 0,
    available: 0,
    totalAssets: 0,
  };
}

function emptyAnalytics(): OpsAnalytics {
  return {
    pulse: emptyPulse(),
    revenueByWeek: [],
    invoiceStatus: [],
    pipelineBars: [],
    topClients: [],
    topEquipment: [],
    revenueByCategory: [],
    demandScatter: [],
    shopAgingBuckets: { d0_3: 0, d4_7: 0, d8_14: 0, d15: 0 },
    shopOpenedByWeek: [],
    shopAgingRows: [],
  };
}

function mapPulse(row: Record<string, unknown> | undefined): OpsPulse {
  if (!row) return emptyPulse();
  return {
    criticalBlockers: asNumber(row.criticalBlockers),
    shopStuck7d: asNumber(row.shopStuck7d),
    arAtRisk: asNumber(row.arAtRisk),
    draftInvoices: asNumber(row.draftInvoices),
    fleetOnHire: asNumber(row.fleetOnHire),
    utilizationPct: asNumber(row.utilizationPct),
    pipelineOpen: asNumber(row.pipelineOpen),
    available: asNumber(row.available),
    totalAssets: asNumber(row.totalAssets),
  };
}

export async function getOpsAnalytics(): Promise<OpsAnalytics> {
  const db = await rentalDb();
  const { data, error } = await db.rpc("rental_ops_analytics");
  if (error || !data || typeof data !== "object") {
    if (error) {
      console.error("[getOpsAnalytics]", error.message);
    }
    return {
      ...emptyAnalytics(),
      loadError: error?.message ?? "Analytics unavailable",
    };
  }

  const b = data as Record<string, unknown>;
  const buckets = (b.shopAgingBuckets ?? {}) as Record<string, unknown>;

  return {
    pulse: mapPulse(b.pulse as Record<string, unknown> | undefined),
    revenueByWeek: Array.isArray(b.revenueByWeek)
      ? (b.revenueByWeek as RevenueWeek[]).map((r) => ({
          label: String(r.label),
          week_start: String(r.week_start),
          total: asNumber(r.total),
        }))
      : [],
    invoiceStatus: Array.isArray(b.invoiceStatus)
      ? (b.invoiceStatus as { name: string; value: number }[]).map((r) => ({
          name: String(r.name),
          value: asNumber(r.value),
        }))
      : [],
    pipelineBars: Array.isArray(b.pipelineBars)
      ? (b.pipelineBars as { name: string; count: number }[]).map((r) => ({
          name: String(r.name),
          count: asNumber(r.count),
        }))
      : [],
    topClients: Array.isArray(b.topClients)
      ? (b.topClients as TopClient[]).map((r) => ({
          id: String(r.id),
          name: String(r.name),
          orders: asNumber(r.orders),
          billed: asNumber(r.billed),
        }))
      : [],
    topEquipment: Array.isArray(b.topEquipment)
      ? (b.topEquipment as TopEquipment[]).map((r) => ({
          id: String(r.id),
          sku: String(r.sku),
          name: String(r.name),
          hire_events: asNumber(r.hire_events),
          hire_days: asNumber(r.hire_days),
          revenue: asNumber(r.revenue),
        }))
      : [],
    revenueByCategory: Array.isArray(b.revenueByCategory)
      ? (b.revenueByCategory as CategoryRevenue[]).map((r) => ({
          name: String(r.name),
          size: asNumber(r.size),
        }))
      : [],
    demandScatter: Array.isArray(b.demandScatter)
      ? (b.demandScatter as DemandPoint[]).map((r) => ({
          name: String(r.name),
          x: asNumber(r.x),
          y: asNumber(r.y),
          z: asNumber(r.z),
        }))
      : [],
    shopAgingBuckets: {
      d0_3: asNumber(buckets.d0_3),
      d4_7: asNumber(buckets.d4_7),
      d8_14: asNumber(buckets.d8_14),
      d15: asNumber(buckets.d15),
    },
    shopOpenedByWeek: Array.isArray(b.shopOpenedByWeek)
      ? (b.shopOpenedByWeek as RevenueWeek[]).map((r) => ({
          label: String(r.label),
          week_start: String(r.week_start),
          total: asNumber(r.total),
        }))
      : [],
    shopAgingRows: Array.isArray(b.shopAgingRows)
      ? (b.shopAgingRows as ShopAgingRow[]).map((r) => ({
          id: String(r.id),
          serial_number: String(r.serial_number),
          sku: String(r.sku),
          status: String(r.status),
          title: String(r.title),
          days_open: asNumber(r.days_open),
          href: String(r.href ?? "/workshop/repairs"),
        }))
      : [],
  };
}

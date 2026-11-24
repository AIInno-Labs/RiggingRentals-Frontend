import { rentalDb, asNumber } from "@/lib/supabase/rental-db";

export type FleetKpis = {
  totalAssets: number;
  available: number;
  onHire: number;
  inMaintenance: number;
  inInspection: number;
  utilizationPct: number;
  openOrders: number;
  offRentPending: number;
  openWorkOrders: number;
  scheduledDeliveries: number;
  draftInvoiceTotal: number;
  approvedInvoiceTotal: number;
  certsExpiringSoon: number;
  certsExpired: number;
};

export type RecentOrder = {
  id: string;
  order_number: string;
  status: string;
  jobsite_name: string;
  company_name: string;
};

export type OpsAlert = {
  severity: "critical" | "high" | "medium" | "low" | string;
  title: string;
  detail: string;
  href: string;
};

export type StatusCount = { status: string; count: number };
export type DonutSliceData = { key: string; label: string; count: number };

function emptyKpis(): FleetKpis {
  return {
    totalAssets: 0,
    available: 0,
    onHire: 0,
    inMaintenance: 0,
    inInspection: 0,
    utilizationPct: 0,
    openOrders: 0,
    offRentPending: 0,
    openWorkOrders: 0,
    scheduledDeliveries: 0,
    draftInvoiceTotal: 0,
    approvedInvoiceTotal: 0,
    certsExpiringSoon: 0,
    certsExpired: 0,
  };
}

function mapKpis(row: Record<string, unknown>): FleetKpis {
  const totalAssets = asNumber(row.totalAssets);
  const onHire = asNumber(row.onHire);
  const inInspection = asNumber(row.inInspection);
  return {
    totalAssets,
    available: asNumber(row.available),
    onHire,
    inMaintenance: asNumber(row.inMaintenance),
    inInspection,
    utilizationPct:
      totalAssets === 0
        ? 0
        : Math.round(((onHire + inInspection) / totalAssets) * 1000) / 10,
    openOrders: asNumber(row.openOrders),
    offRentPending: asNumber(row.offRentPending),
    openWorkOrders: asNumber(row.openWorkOrders),
    scheduledDeliveries: asNumber(row.scheduledDeliveries),
    draftInvoiceTotal: asNumber(row.draftInvoiceTotal),
    approvedInvoiceTotal: asNumber(row.approvedInvoiceTotal),
    certsExpiringSoon: asNumber(row.certsExpiringSoon),
    certsExpired: asNumber(row.certsExpired),
  };
}

export async function getDashboardBundle(): Promise<{
  kpis: FleetKpis;
  recentOrders: RecentOrder[];
  alerts: OpsAlert[];
  statusMix: StatusCount[];
  pipelineMix: StatusCount[];
  fleetDonut: DonutSliceData[];
  pipelineDonut: DonutSliceData[];
}> {
  const db = await rentalDb();
  const { data, error } = await db.rpc("rental_dashboard_bundle");
  if (error || !data || typeof data !== "object") {
    return {
      kpis: emptyKpis(),
      recentOrders: [],
      alerts: [],
      statusMix: [],
      pipelineMix: [],
      fleetDonut: [],
      pipelineDonut: [],
    };
  }

  const bundle = data as {
    kpis?: Record<string, unknown>;
    recentOrders?: RecentOrder[];
    alerts?: OpsAlert[];
    statusMix?: StatusCount[];
    pipelineMix?: StatusCount[];
    fleetDonut?: DonutSliceData[];
    pipelineDonut?: DonutSliceData[];
  };

  return {
    kpis: bundle.kpis ? mapKpis(bundle.kpis) : emptyKpis(),
    recentOrders: Array.isArray(bundle.recentOrders) ? bundle.recentOrders : [],
    alerts: Array.isArray(bundle.alerts) ? bundle.alerts : [],
    statusMix: Array.isArray(bundle.statusMix) ? bundle.statusMix : [],
    pipelineMix: Array.isArray(bundle.pipelineMix) ? bundle.pipelineMix : [],
    fleetDonut: Array.isArray(bundle.fleetDonut) ? bundle.fleetDonut : [],
    pipelineDonut: Array.isArray(bundle.pipelineDonut)
      ? bundle.pipelineDonut
      : [],
  };
}

export async function getFleetKpis(): Promise<FleetKpis> {
  const { kpis } = await getDashboardBundle();
  return kpis;
}

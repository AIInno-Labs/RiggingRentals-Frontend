import { z } from "zod";
import { ACTIVE_ORDER_STATUSES, type AssetStatus, type OrderStatus } from "@/features/domain/types";

export const availabilityInputSchema = z.object({
  catalogId: z.string().guid(),
  startAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  endAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  requestedQty: z.number().int().positive(),
  excludeOrderId: z.string().guid().optional(),
});

export type AvailabilityInput = z.infer<typeof availabilityInputSchema>;

export type AssetRow = {
  id: string;
  status: AssetStatus;
  certificate_expires_at?: string | null;
};

export type OrderDemandRow = {
  order_id: string;
  status: OrderStatus;
  start_at: string;
  end_at: string;
  off_rent_at: string | null;
  quantity: number;
};

export type AvailabilityResult = {
  catalogId: string;
  physicalCount: number;
  unavailableOpsCount: number;
  reservedDemand: number;
  yardIdle: number;
  availableQty: number;
  requestedQty: number;
  isAvailable: boolean;
};

const OPS_UNAVAILABLE: AssetStatus[] = ["maintenance", "in_inspection", "retired"];

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function certBlocksHire(
  expiresAt: string | null | undefined,
  hireStart: Date,
): boolean {
  if (!expiresAt) return false;
  const exp = new Date(`${expiresAt}T23:59:59`);
  return exp < hireStart;
}

export function computeAvailability(params: {
  catalogId: string;
  startAt: string;
  endAt: string;
  requestedQty: number;
  assets: AssetRow[];
  demands: OrderDemandRow[];
  excludeOrderId?: string;
}): AvailabilityResult {
  const start = new Date(params.startAt);
  const end = new Date(params.endAt);
  const physicalCount = params.assets.length;
  const yardIdle = params.assets.filter((a) => a.status === "available").length;
  const unavailableOpsCount = params.assets.filter(
    (a) =>
      OPS_UNAVAILABLE.includes(a.status) ||
      certBlocksHire(a.certificate_expires_at, start),
  ).length;

  const reservedDemand = params.demands
    .filter((d) => {
      if (params.excludeOrderId && d.order_id === params.excludeOrderId) {
        return false;
      }
      if (!ACTIVE_ORDER_STATUSES.includes(d.status)) return false;
      const dEnd = new Date(d.off_rent_at ?? d.end_at);
      const dStart = new Date(d.start_at);
      return rangesOverlap(start, end, dStart, dEnd);
    })
    .reduce((sum, d) => sum + d.quantity, 0);

  const availableQty = Math.max(
    0,
    physicalCount - unavailableOpsCount - reservedDemand,
  );

  return {
    catalogId: params.catalogId,
    physicalCount,
    unavailableOpsCount,
    reservedDemand,
    yardIdle,
    availableQty,
    requestedQty: params.requestedQty,
    isAvailable: availableQty >= params.requestedQty,
  };
}

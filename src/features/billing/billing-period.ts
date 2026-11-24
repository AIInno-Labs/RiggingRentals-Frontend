import { toDateOnly } from "@/features/pricing/calculate-rate";
import { asNumber } from "@/lib/supabase/rental-db";

export type QcFeeFields = {
  damaged?: boolean;
  damage_fee?: number;
  dirty?: boolean;
  cleaning_fee?: number;
  missing?: boolean;
  missing_fee?: number;
  meter_overage_fee?: number;
};

/** QC amounts on file — fee value wins over checkbox state (workshop can mis-tick flags). */
export function hasBillableQcFees(a: QcFeeFields): boolean {
  return (
    asNumber(a.meter_overage_fee) > 0 ||
    asNumber(a.damage_fee) > 0 ||
    asNumber(a.cleaning_fee) > 0 ||
    asNumber(a.missing_fee) > 0
  );
}

/** Earliest on-hire day: order start, or first dispatch if gear went out earlier. */
export function effectiveHireStartDate(
  orderStartAt: string,
  dispatchedAts: (string | null | undefined)[],
): string {
  const contractual = toDateOnly(orderStartAt);
  let earliestDispatch: string | null = null;
  for (const raw of dispatchedAts) {
    if (!raw) continue;
    const day = toDateOnly(raw);
    if (!earliestDispatch || day < earliestDispatch) earliestDispatch = day;
  }
  if (!earliestDispatch || earliestDispatch >= contractual) return contractual;
  return earliestDispatch;
}

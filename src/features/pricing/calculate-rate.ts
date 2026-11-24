import { z } from "zod";

export const rateInputSchema = z.object({
  days: z.number().positive(),
  dailyRate: z.number().nonnegative(),
  weeklyRate: z.number().nonnegative(),
  monthlyRate: z.number().nonnegative(),
});

export type RateInput = z.infer<typeof rateInputSchema>;

export type RateBreakdown = {
  billableDays: number;
  method: "daily" | "weekly" | "monthly";
  amount: number;
  detail: string;
  /** Months / weeks / days display like RigRent invoices: 0/2/4 */
  mwd: string;
};

/** Calendar-style M/W/D chips for tax invoices (28-day months, 7-day weeks). */
export function monthsWeeksDays(days: number): {
  months: number;
  weeks: number;
  days: number;
  label: string;
} {
  const total = Math.max(0, Math.ceil(days));
  const months = Math.floor(total / 28);
  const remAfterMonth = total % 28;
  const weeks = Math.floor(remAfterMonth / 7);
  const remDays = remAfterMonth % 7;
  return {
    months,
    weeks,
    days: remDays,
    label: `${months}/${weeks}/${remDays}`,
  };
}

/**
 * Industry 1-4-4 style rental billing:
 * 1–6 days: daily × days, capped at 1× weekly
 * 7–27 days: weekly × ceil(days/7) effectively as weeks = days/7 floored groups
 * 28+ days: monthly cycles of 28 days
 */
export function calculateTieredRate(input: RateInput): RateBreakdown {
  const parsed = rateInputSchema.parse(input);
  const days = Math.ceil(parsed.days);

  const mwd = monthsWeeksDays(days).label;

  if (days >= 28) {
    const cycles = Math.ceil(days / 28);
    const amount = roundMoney(cycles * parsed.monthlyRate);
    return {
      billableDays: days,
      method: "monthly",
      amount,
      detail: `${cycles} × monthly (${days} days)`,
      mwd,
    };
  }

  if (days >= 7) {
    const weeks = Math.ceil(days / 7);
    const amount = roundMoney(weeks * parsed.weeklyRate);
    return {
      billableDays: days,
      method: "weekly",
      amount,
      detail: `${weeks} × weekly (${days} days)`,
      mwd,
    };
  }

  const dailyTotal = days * parsed.dailyRate;
  const amount = roundMoney(Math.min(dailyTotal, parsed.weeklyRate));
  return {
    billableDays: days,
    method: "daily",
    amount,
    detail:
      dailyTotal > parsed.weeklyRate
        ? `${days} days capped at weekly`
        : `${days} × daily`,
    mwd,
  };
}

/** Inclusive calendar days between two date-only ISO strings (YYYY-MM-DD). */
export function inclusiveCalendarDays(
  periodStart: string,
  periodEnd: string,
): number {
  const start = new Date(`${periodStart.slice(0, 10)}T00:00:00Z`).getTime();
  const end = new Date(`${periodEnd.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

export function toDateOnly(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

export function lastDayOfMonth(year: number, monthIndex0: number): string {
  const d = new Date(Date.UTC(year, monthIndex0 + 1, 0));
  return d.toISOString().slice(0, 10);
}

export function firstDayOfMonth(year: number, monthIndex0: number): string {
  return new Date(Date.UTC(year, monthIndex0, 1)).toISOString().slice(0, 10);
}

export function billableDaysBetween(
  startAt: Date | string,
  endAt: Date | string,
): number {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  const ms = Math.max(0, end - start);
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export function calculateMeterOverage(params: {
  startMeter: number;
  endMeter: number;
  billableDays: number;
  overageRatePerHour: number;
  hoursPerDayAllowance?: number;
}): { overageHours: number; overageFee: number } {
  const allowance = (params.hoursPerDayAllowance ?? 8) * params.billableDays;
  const used = Math.max(0, params.endMeter - params.startMeter);
  const overageHours = Math.max(0, used - allowance);
  return {
    overageHours: roundMoney(overageHours),
    overageFee: roundMoney(overageHours * params.overageRatePerHour),
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

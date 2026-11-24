"use server";

import { z } from "zod";
import { calculateTieredRate, billableDaysBetween } from "@/features/pricing/calculate-rate";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  dailyRate: z.number().nonnegative(),
  weeklyRate: z.number().nonnegative(),
  monthlyRate: z.number().nonnegative(),
});

export async function calculateRateAction(
  input: unknown,
): Promise<ActionResult<ReturnType<typeof calculateTieredRate>>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }

  const days = billableDaysBetween(parsed.data.startAt, parsed.data.endAt);
  try {
    const result = calculateTieredRate({
      days,
      dailyRate: parsed.data.dailyRate,
      weeklyRate: parsed.data.weeklyRate,
      monthlyRate: parsed.data.monthlyRate,
    });
    return ok(result);
  } catch (e) {
    return fail("CALC_ERROR", e instanceof Error ? e.message : "Calculation failed");
  }
}

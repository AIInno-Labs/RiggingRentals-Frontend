"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { rentalDb } from "@/lib/supabase/rental-db";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

const schema = z.object({
  order_id: z.string().guid(),
  accepted_by: z.string().min(1, "Who accepted?"),
  method: z.enum(["email_reply", "phone", "signed_pdf", "in_person"]),
});

export async function recordHireAcceptanceAction(
  input: unknown,
): Promise<ActionResult<{ order_id: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data: order } = await db
    .from("orders")
    .select("id, status")
    .eq("id", parsed.data.order_id)
    .single();
  if (!order) return fail("DB_ERROR", "Order not found");
  const status = (order as { status: string }).status;
  if (status !== "draft" && status !== "confirmed" && status !== "pre_pick") {
    return fail("VALIDATION_ERROR", "Too late to record acceptance on this status");
  }

  const { error } = await db
    .from("orders")
    .update({
      accepted_hire_agreement_at: new Date().toISOString(),
      hire_accepted_by: parsed.data.accepted_by,
      hire_accepted_method: parsed.data.method,
    })
    .eq("id", parsed.data.order_id);
  if (error) return fail("DB_ERROR", error.message);

  revalidatePath(`/admin/orders/${parsed.data.order_id}`);
  revalidatePath("/admin/pipeline");
  return ok({ order_id: parsed.data.order_id });
}

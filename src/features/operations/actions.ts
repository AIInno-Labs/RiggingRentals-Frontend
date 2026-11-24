"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { rentalDb } from "@/lib/supabase/rental-db";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { requireLogisticsMutator } from "@/features/rbac/require-role";

const updateWoSchema = z.object({
  id: z.string().guid(),
  status: z.enum([
    "open",
    "in_progress",
    "waiting_parts",
    "completed",
    "cancelled",
  ]),
  actual_hours: z.number().nonnegative().optional(),
  parts_cost: z.number().nonnegative().optional(),
  labor_cost: z.number().nonnegative().optional(),
});

const updateDeliverySchema = z.object({
  id: z.string().guid(),
  status: z.enum(["scheduled", "en_route", "completed", "cancelled"]),
  pod_signed_by: z.string().optional(),
  pod_notes: z.string().optional(),
  pod_photo_url: z.string().optional(),
});

export async function createRepairWorkOrderAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireLogisticsMutator();
  if (!auth.success) return auth;
  const schema = z.object({
    asset_id: z.string().guid(),
    title: z.string().min(3),
    description: z.string().default(""),
    estimated_hours: z.number().nonnegative().default(4),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { data, error } = await db
    .from("maintenance_work_orders")
    .insert({
      asset_id: parsed.data.asset_id,
      work_type: "repair",
      status: "open",
      title: parsed.data.title,
      description: parsed.data.description,
      estimated_hours: parsed.data.estimated_hours,
      parts_cost: 0,
      labor_cost: 0,
      due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return fail("DB_ERROR", error?.message ?? "Insert failed");

  await db
    .from("equipment_assets")
    .update({ status: "maintenance" })
    .eq("id", parsed.data.asset_id);

  revalidatePath("/workshop/repairs");
  revalidatePath("/admin/maintenance");
  revalidatePath("/workshop");
  return ok({ id: (data as { id: string }).id });
}

export async function updateWorkOrderAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireLogisticsMutator();
  if (!auth.success) return auth;
  const parsed = updateWoSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const patch: Record<string, string | number | null> = {
    status: parsed.data.status,
  };
  if (parsed.data.actual_hours !== undefined) {
    patch.actual_hours = parsed.data.actual_hours;
  }
  if (parsed.data.parts_cost !== undefined) patch.parts_cost = parsed.data.parts_cost;
  if (parsed.data.labor_cost !== undefined) patch.labor_cost = parsed.data.labor_cost;
  if (parsed.data.status === "completed") {
    patch.completed_at = new Date().toISOString();
  }
  const { data: wo } = await db
    .from("maintenance_work_orders")
    .select("asset_id")
    .eq("id", parsed.data.id)
    .single();
  const { error } = await db
    .from("maintenance_work_orders")
    .update(patch)
    .eq("id", parsed.data.id);
  if (error) return fail("DB_ERROR", error.message);

  if (parsed.data.status === "completed" && wo) {
    await db
      .from("equipment_assets")
      .update({ status: "available" })
      .eq("id", (wo as { asset_id: string }).asset_id)
      .in("status", ["maintenance", "in_inspection"]);
  }

  revalidatePath("/admin/maintenance");
  revalidatePath("/workshop/repairs");
  revalidatePath("/workshop");
  revalidatePath("/admin");
  return ok({ id: parsed.data.id });
}

export async function updateDeliveryTaskAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireLogisticsMutator();
  if (!auth.success) return auth;
  const parsed = updateDeliverySchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const patch: Record<string, string | null> = { status: parsed.data.status };
  if (parsed.data.status === "completed") {
    if (!parsed.data.pod_signed_by?.trim()) {
      return fail(
        "VALIDATION_ERROR",
        "Enter who signed / received before completing the run.",
      );
    }
    patch.completed_at = new Date().toISOString();
    patch.pod_signed_by = parsed.data.pod_signed_by.trim();
    patch.pod_notes = parsed.data.pod_notes?.trim() ?? "";
    if (parsed.data.pod_photo_url) {
      patch.pod_photo_url = parsed.data.pod_photo_url;
    }
  }
  const { error } = await db
    .from("delivery_tasks")
    .update(patch)
    .eq("id", parsed.data.id);
  if (error) return fail("DB_ERROR", error.message);
  revalidatePath("/admin/logistics");
  revalidatePath("/admin");
  return ok({ id: parsed.data.id });
}

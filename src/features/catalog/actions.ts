"use server";

import { revalidatePath } from "next/cache";
import { assetSchema, catalogSchema, clientSchema } from "@/features/catalog/schemas";
import { formatCatalogDimensions } from "@/features/catalog/dimensions-spec";
import { rentalDb } from "@/lib/supabase/rental-db";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/actions/result";
import { requireFleetAdmin, requireProfile } from "@/features/rbac/require-role";

const CERT_BUCKET = "rental-certificates";

export async function upsertClientAction(
  input: unknown,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireProfile();
  if (!auth.success) return auth;
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  if (id) {
    const { error } = await db.from("clients").update(parsed.data).eq("id", id);
    if (error) return fail("DB_ERROR", error.message);
    revalidatePath("/admin/clients");
    revalidatePath(`/admin/clients/${id}`);
    return ok({ id });
  }
  const { data, error } = await db
    .from("clients")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error || !data) return fail("DB_ERROR", error?.message ?? "Insert failed");
  revalidatePath("/admin/clients");
  return ok({ id: (data as { id: string }).id });
}

export async function upsertCatalogAction(
  input: unknown,
  id?: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireFleetAdmin();
  if (!auth.success) return auth;
  const parsed = catalogSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const { weight, length, ...dbData } = parsed.data;
  let dims = dbData.dimensions;
  if ((weight !== undefined || length !== undefined) && !dims) {
    dims = formatCatalogDimensions(weight, length);
  }
  const payload = {
    ...dbData,
    dimensions: dims,
  };
  const db = await rentalDb();
  if (id) {
    const { error } = await db
      .from("equipment_catalog")
      .update(payload)
      .eq("id", id);
    if (error) return fail("DB_ERROR", error.message);
    revalidatePath("/admin/catalog");
    return ok({ id });
  }
  const { data, error } = await db
    .from("equipment_catalog")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) return fail("DB_ERROR", error?.message ?? "Insert failed");
  revalidatePath("/admin/catalog");
  return ok({ id: (data as { id: string }).id });
}

export async function createAssetAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireFleetAdmin();
  if (!auth.success) return auth;
  const parsed = assetSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const payload = {
    ...parsed.data,
    certificate_expires_at: parsed.data.certificate_expires_at || null,
    next_inspection_at: parsed.data.next_inspection_at || null,
  };
  const { data, error } = await db
    .from("equipment_assets")
    .insert(payload)
    .select("id")
    .single();
  if (error || !data) return fail("DB_ERROR", error?.message ?? "Insert failed");
  revalidatePath("/admin/catalog");
  return ok({ id: (data as { id: string }).id });
}

export async function updateAssetCertAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireFleetAdmin();
  if (!auth.success) return auth;
  const { updateAssetCertSchema } = await import("@/features/catalog/schemas");
  const parsed = updateAssetCertSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid");
  }
  const db = await rentalDb();
  const { id, ...rest } = parsed.data;
  const patch: Record<string, unknown> = {
    certificate_number: rest.certificate_number,
    certificate_type: rest.certificate_type,
    certificate_expires_at: rest.certificate_expires_at || null,
    next_inspection_at: rest.next_inspection_at || null,
  };
  if (rest.certificate_file_path !== undefined) {
    patch.certificate_file_path = rest.certificate_file_path;
  }
  if (rest.certificate_file_name !== undefined) {
    patch.certificate_file_name = rest.certificate_file_name;
  }
  const { error } = await db.from("equipment_assets").update(patch).eq("id", id);
  if (error) return fail("DB_ERROR", error.message);
  revalidatePath("/admin/catalog");
  revalidatePath("/workshop");
  return ok({ id });
}

export async function getCertificateDownloadUrlAction(
  assetId: string,
): Promise<ActionResult<{ url: string; fileName: string }>> {
  const auth = await requireProfile();
  if (!auth.success) return auth;
  if (!assetId) return fail("VALIDATION_ERROR", "Asset id required");

  const db = await rentalDb();
  const { data, error } = await db
    .from("equipment_assets")
    .select("certificate_file_path, certificate_file_name")
    .eq("id", assetId)
    .single();
  if (error || !data) return fail("DB_ERROR", error?.message ?? "Asset not found");

  const row = data as {
    certificate_file_path: string;
    certificate_file_name: string;
  };
  if (!row.certificate_file_path) {
    return fail("VALIDATION_ERROR", "No certificate file on this unit");
  }

  const supabase = await createClient();
  const { data: signed, error: signError } = await supabase.storage
    .from(CERT_BUCKET)
    .createSignedUrl(row.certificate_file_path, 120);
  if (signError || !signed?.signedUrl) {
    return fail("DB_ERROR", signError?.message ?? "Could not create download link");
  }
  return ok({
    url: signed.signedUrl,
    fileName: row.certificate_file_name || row.certificate_file_path.split("/").pop() || "certificate",
  });
}

export async function clearCertificateFileAction(
  assetId: string,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireFleetAdmin();
  if (!auth.success) return auth;
  if (!assetId) return fail("VALIDATION_ERROR", "Asset id required");

  const db = await rentalDb();
  const { data, error } = await db
    .from("equipment_assets")
    .select("certificate_file_path")
    .eq("id", assetId)
    .single();
  if (error || !data) return fail("DB_ERROR", error?.message ?? "Asset not found");

  const path = (data as { certificate_file_path: string }).certificate_file_path;
  if (path) {
    const supabase = await createClient();
    await supabase.storage.from(CERT_BUCKET).remove([path]);
  }

  const { error: updateError } = await db
    .from("equipment_assets")
    .update({ certificate_file_path: "", certificate_file_name: "" })
    .eq("id", assetId);
  if (updateError) return fail("DB_ERROR", updateError.message);

  revalidatePath("/admin/catalog");
  revalidatePath("/workshop");
  return ok({ id: assetId });
}

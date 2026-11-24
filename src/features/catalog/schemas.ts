import { z } from "zod";

export const clientSchema = z.object({
  company_name: z.string().min(1),
  contact_name: z.string().default(""),
  email: z
    .string()
    .default("")
    .transform((v) => v.trim())
    .refine(
      (v) => v === "" || z.string().email().safeParse(v).success,
      "Enter a valid email or leave blank",
    ),
  phone: z.string().default(""),
  billing_address: z.string().default(""),
  notes: z.string().default(""),
  credit_account: z.boolean().default(true),
  credit_limit: z.number().nonnegative().default(0),
  payment_terms_days: z.number().int().nonnegative().default(30),
  on_stop: z.boolean().default(false),
  on_stop_reason: z.string().default(""),
});

export const catalogSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1, "Category is required"),
  description: z.string().default(""),
  dimensions: z.string().default(""),
  weight: z.string().optional(),
  length: z.string().optional(),
  tracks_meter: z.boolean().default(false),
  daily_rate: z.number().nonnegative(),
  weekly_rate: z.number().nonnegative(),
  monthly_rate: z.number().nonnegative(),
  overage_rate_per_hour: z.number().nonnegative().default(0),
  default_fuel_surcharge: z.number().nonnegative().default(0),
  is_active: z.boolean().default(true),
});

export const assetSchema = z.object({
  catalog_id: z.string().guid(),
  serial_number: z.string().min(1),
  meter_hours: z.number().nonnegative().default(0),
  status: z
    .enum([
      "available",
      "reserved",
      "on_hire",
      "in_inspection",
      "maintenance",
      "retired",
    ])
    .default("available"),
  notes: z.string().default(""),
  certificate_number: z.string().default(""),
  certificate_type: z.string().default("LOLER"),
  certificate_expires_at: z.string().nullable().optional(),
  next_inspection_at: z.string().nullable().optional(),
});

export const updateAssetCertSchema = z.object({
  id: z.string().guid(),
  certificate_number: z.string().default(""),
  certificate_type: z.string().default("LOLER"),
  certificate_expires_at: z.string().nullable().optional(),
  next_inspection_at: z.string().nullable().optional(),
  certificate_file_path: z.string().optional(),
  certificate_file_name: z.string().optional(),
});

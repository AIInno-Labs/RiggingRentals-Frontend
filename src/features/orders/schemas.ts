import { z } from "zod";
import { ORDER_STATUSES } from "@/features/domain/types";

export const orderItemInputSchema = z
  .object({
    category: z.string().min(1, "Select a category"),
    /** Empty string allowed on draft quotes (category-only). */
    catalog_id: z.union([z.literal(""), z.string().guid("Invalid equipment")]),
    quantity: z
      .number({ error: "Quantity must be a number" })
      .int("Quantity must be a whole number")
      .positive("Quantity must be at least 1"),
    line_notes: z.string().default(""),
    daily_rate: z.number().nonnegative().optional(),
    weekly_rate: z.number().nonnegative().optional(),
    monthly_rate: z.number().nonnegative().optional(),
    rate_override: z.boolean().default(false),
  })
  .refine((row) => !!row.category.trim(), {
    message: "Select a category",
    path: ["category"],
  });

export const createOrderSchema = z.object({
  client_id: z.string().guid("Select a client"),
  start_at: z.string().min(1, "Start date is required"),
  end_at: z.string().min(1, "End date is required"),
  damage_waiver: z.boolean().default(false),
  fuel_surcharge: z.number().nonnegative("Fuel surcharge cannot be negative").default(0),
  security_deposit: z
    .number()
    .nonnegative("Security deposit cannot be negative")
    .default(0),
  notes: z.string().default(""),
  jobsite_name: z.string().default(""),
  delivery_address: z.string().default(""),
  purchase_order: z.string().default(""),
  delivery_required: z.boolean().default(true),
  pickup_required: z.boolean().default(true),
  items: z.array(orderItemInputSchema).min(1, "Add at least one equipment line"),
});

export const updateOrderStatusSchema = z.object({
  order_id: z.string().guid(),
  status: z.enum(ORDER_STATUSES),
});

export const updateOrderNotesSchema = z.object({
  order_id: z.string().guid(),
  quote_notes: z.string().default(""),
  notes: z.string().default(""),
});

export const updateDraftOrderSchema = createOrderSchema.extend({
  order_id: z.string().guid(),
});

export const updateLineNotesSchema = z.object({
  order_item_id: z.string().guid(),
  line_notes: z.string().default(""),
});

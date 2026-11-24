export const ASSET_STATUSES = [
  "available",
  "reserved",
  "on_hire",
  "in_inspection",
  "maintenance",
  "retired",
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ORDER_STATUSES = [
  "draft",
  "confirmed",
  "pre_pick",
  "dispatched",
  "off_rent_pending",
  "returned",
  "invoiced",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Hard locks + soft holds (draft quotes) that reduce available qty. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "confirmed",
  "pre_pick",
  "dispatched",
  "off_rent_pending",
];

export type Client = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  billing_address: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type CatalogItem = {
  id: string;
  sku: string;
  name: string;
  description: string;
  tracks_meter: boolean;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  overage_rate_per_hour: number;
  default_fuel_surcharge: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EquipmentAsset = {
  id: string;
  catalog_id: string;
  serial_number: string;
  meter_hours: number;
  status: AssetStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type RentalOrder = {
  id: string;
  order_number: string;
  client_id: string;
  status: OrderStatus;
  start_at: string;
  end_at: string;
  off_rent_at: string | null;
  damage_waiver: boolean;
  fuel_surcharge: number;
  security_deposit: number;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  catalog_id: string;
  quantity: number;
  daily_rate: number;
  weekly_rate: number;
  monthly_rate: number;
  overage_rate_per_hour: number;
  line_notes: string;
  created_at: string;
};

export type OrderAssetAssignment = {
  id: string;
  order_item_id: string;
  asset_id: string;
  dispatch_meter: number | null;
  return_meter: number | null;
  inspection_notes: string;
  damaged: boolean;
  damage_fee: number;
  meter_overage_hours: number;
  meter_overage_fee: number;
  dispatched_at: string | null;
  returned_at: string | null;
  created_at: string;
};

export type Invoice = {
  id: string;
  order_id: string;
  invoice_number: string;
  status: "draft" | "approved" | "void";
  subtotal: number;
  discount_amount: number;
  deposit_applied: number;
  total: number;
  notes: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceLine = {
  id: string;
  invoice_id: string;
  kind:
    | "rental"
    | "meter_overage"
    | "fuel"
    | "damage"
    | "deposit_credit"
    | "discount"
    | "other";
  description: string;
  quantity: number;
  unit_amount: number;
  line_total: number;
  sort_order: number;
};

export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

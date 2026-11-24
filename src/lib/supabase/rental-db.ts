import { createClient } from "@/lib/supabase/server";

/** Typed rental-schema server client. */
export async function rentalDb() {
  return createClient();
}

export function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

/** PostgREST computed relationships often return an array; normalize to one row. */
export function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function catalogLabel(
  value:
    | { sku?: string; name?: string }
    | { sku?: string; name?: string }[]
    | null
    | undefined,
): string {
  const row = unwrapOne(value);
  if (!row) return "—";
  const sku = row.sku ?? "";
  const name = row.name ?? "";
  const label = `${sku} ${name}`.trim();
  return label || "—";
}

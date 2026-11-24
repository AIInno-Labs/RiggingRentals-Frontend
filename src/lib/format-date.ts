/** Stable AU date/time formatting — avoids SSR/client locale hydration mismatches. */

export function formatDateAu(
  value: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", opts);
}

export function formatDateTimeAu(
  value: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  });
}

export function formatDayLabelAu(isoDay: string): string {
  return new Date(`${isoDay}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

"use client";

import { CHART } from "./theme";

export function ChartLegend({
  items,
}: {
  items: { color: string; label: string; value?: string | number }[];
}) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 shrink-0 rounded-sm"
            style={{ background: item.color || CHART.zinc500 }}
          />
          <span>{item.label}</span>
          {item.value !== undefined ? (
            <span className="font-semibold tabular-nums text-foreground">
              {item.value}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

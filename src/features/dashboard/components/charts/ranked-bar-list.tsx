"use client";

import { cn } from "@/lib/utils";

export type RankedBarItem = {
  id: string;
  name: string;
  sublabel?: string;
  value: number;
  valueLabel: string;
  href?: string;
};

export function RankedBarList({
  items,
  emptyMessage = "No data yet",
}: {
  items: RankedBarItem[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[#d4d4d8] text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const pct =
          item.value <= 0
            ? 0
            : Math.max(4, Math.round((item.value / max) * 100));
        const body = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.name}
                </p>
                {item.sublabel ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {item.sublabel}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {item.valueLabel}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f4f4f5]">
              <span
                className="block h-full rounded-full bg-[#f5d400]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        );

        return (
          <li key={item.id}>
            {item.href ? (
              <a
                href={item.href}
                className={cn(
                  "block rounded-lg px-1 py-0.5 transition-colors hover:bg-[#fafafa]",
                )}
              >
                {body}
              </a>
            ) : (
              <div className="px-1 py-0.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

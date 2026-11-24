"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export type DonutSlice = {
  key: string;
  label: string;
  count: number;
  color: string;
  href?: string;
};

const DEFAULT_COLORS = ["#f5d400", "#111111", "#71717a", "#2f6f4e", "#b42318"];

export function DonutChart({
  title,
  subtitle,
  slices,
  colors = DEFAULT_COLORS,
  hrefByKey,
}: {
  title: string;
  subtitle?: string;
  slices: { key: string; label: string; count: number; href?: string }[];
  colors?: string[];
  hrefByKey?: Record<string, string>;
}) {
  const router = useRouter();
  const totalCount = slices.reduce((s, x) => s + x.count, 0);
  const total = totalCount || 1;
  const enriched: DonutSlice[] = slices.map((s, i) => ({
    ...s,
    color: colors[i % colors.length]!,
    href: s.href ?? hrefByKey?.[s.key],
  }));

  let angle = -90;
  const paths = enriched
    .filter((s) => s.count > 0)
    .map((s) => {
      const sweep = (s.count / total) * 360;
      const start = angle;
      angle += sweep;
      return {
        ...s,
        d: describeArc(80, 80, 54, start, start + Math.max(sweep, 0.01)),
        tip: `${s.label}: ${s.count}`,
      };
    });

  return (
    <div className="steel-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
      <div className="relative mx-auto h-40 w-40 shrink-0">
        <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden>
          <circle
            cx="80"
            cy="80"
            r="54"
            fill="none"
            stroke="#e8e2d6"
            strokeWidth="22"
          />
          {paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth="22"
              strokeLinecap="butt"
              className={
                p.href
                  ? "cursor-pointer transition-opacity hover:opacity-80"
                  : undefined
              }
              onClick={() => {
                if (p.href) router.push(p.href);
              }}
            >
              <title>{p.tip}</title>
            </path>
          ))}
          <text
            x="80"
            y="76"
            textAnchor="middle"
            className="fill-foreground"
            fontSize="22"
            fontWeight="700"
          >
            {totalCount}
          </text>
          <text
            x="80"
            y="94"
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="9"
          >
            total
          </text>
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
        ) : null}
        <ul className="mt-2 space-y-1.5 text-sm">
          {enriched.map((s) => {
            const row = (
              <>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.label}
                </span>
                <span className="font-semibold tabular-nums">{s.count}</span>
              </>
            );
            return (
              <li key={s.key}>
                {s.href ? (
                  <Link
                    href={s.href}
                    prefetch
                    title={`Open ${s.label}`}
                    className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-black/5"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    {row}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const large = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

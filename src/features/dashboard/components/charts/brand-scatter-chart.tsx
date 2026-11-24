"use client";

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { CHART, chartTooltipStyle } from "./theme";
import type { TooltipProps } from "recharts";

export type ScatterPoint = {
  name: string;
  x: number;
  y: number;
  z?: number;
};

function ScatterTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload as ScatterPoint | undefined;
  if (!p) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs text-[#fafafa] shadow-md"
      style={chartTooltipStyle}
    >
      <p className="font-semibold">{p.name}</p>
      <p className="mt-1 text-[#d4d4d8]">
        Hire days {p.x} · Down days {p.y}
        {p.z !== undefined ? ` · Assets ${p.z}` : ""}
      </p>
    </div>
  );
}

/** Deterministic jitter so SSR/client match. */
function jitter(seed: string, amp: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const n = ((h % 1000) / 1000) * 2 - 1;
  return n * amp;
}

export function BrandScatterChart({ data }: { data: ScatterPoint[] }) {
  const capped = [...data]
    .sort((a, b) => b.x - a.x)
    .slice(0, 12)
    .map((p) => ({
      ...p,
      x: Math.max(0, p.x + jitter(`${p.name}-x`, 1.5)),
      y: Math.max(0, p.y + jitter(`${p.name}-y`, 0.4)),
    }));

  if (capped.length === 0) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No demand data yet
      </p>
    );
  }

  const tick = { fill: CHART.zinc500, fontSize: 11 };

  return (
    <div className="h-52 w-full animate-in fade-in duration-500">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={CHART.zinc200} strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            name="Hire days"
            tick={tick}
            axisLine={false}
            label={{
              value: "Hire days →",
              position: "insideBottom",
              offset: -2,
              style: { fill: "#71717a", fontSize: 10 },
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Down days"
            tick={tick}
            axisLine={false}
            width={48}
            label={{
              value: "Down →",
              angle: -90,
              position: "insideLeft",
              style: { fill: "#71717a", fontSize: 10 },
            }}
          />
          <ZAxis type="number" dataKey="z" range={[60, 280]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={<ScatterTooltip />}
          />
          <Scatter data={capped} fill={CHART.ink} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

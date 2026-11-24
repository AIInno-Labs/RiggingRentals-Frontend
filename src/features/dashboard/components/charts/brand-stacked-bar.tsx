"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART, chartTooltipProps } from "./theme";

const STACK_KEYS = [
  { key: "d0_3", label: "0–3d", fill: CHART.green },
  { key: "d4_7", label: "4–7d", fill: CHART.yellow },
  { key: "d8_14", label: "8–14d", fill: CHART.zinc500 },
  { key: "d15", label: "15d+", fill: CHART.red },
] as const;

export function BrandStackedAgingBar({
  data,
}: {
  data: { name: string; d0_3: number; d4_7: number; d8_14: number; d15: number }[];
}) {
  if (data.length === 0 || data.every((d) => d.d0_3 + d.d4_7 + d.d8_14 + d.d15 === 0)) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Shop is clear
      </p>
    );
  }

  const tick = { fill: CHART.zinc500, fontSize: 11 };

  return (
    <div className="h-52 w-full animate-in fade-in duration-500">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={CHART.zinc200} strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={tick} axisLine={false} />
          <YAxis tick={tick} axisLine={false} allowDecimals={false} width={32} />
          <Tooltip {...chartTooltipProps} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: CHART.zinc600 }}
            formatter={(v) => STACK_KEYS.find((s) => s.key === v)?.label ?? v}
          />
          {STACK_KEYS.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="a"
              fill={s.fill}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

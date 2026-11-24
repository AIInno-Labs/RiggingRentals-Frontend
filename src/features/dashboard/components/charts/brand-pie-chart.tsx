"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CHART, chartTooltipProps } from "./theme";

export function BrandPieChart({
  data,
  nameKey = "name",
  valueKey = "value",
}: {
  data: Record<string, string | number>[];
  nameKey?: string;
  valueKey?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No data yet
      </p>
    );
  }

  return (
    <div className="h-52 w-full animate-in fade-in duration-500">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius={48}
            outerRadius={72}
            paddingAngle={2}
            stroke={CHART.white}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={CHART.palette[i % CHART.palette.length]}
              />
            ))}
          </Pie>
          <Tooltip {...chartTooltipProps} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

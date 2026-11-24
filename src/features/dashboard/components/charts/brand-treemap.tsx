"use client";

import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { CHART, chartTooltipStyle } from "./theme";

type Node = { name: string; size: number };

function TreemapContent(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  index?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, name = "", index = 0 } = props;
  if (width < 4 || height < 4) return null;
  const fill = CHART.palette[index % CHART.palette.length]!;
  const dark = fill === CHART.ink || fill === CHART.red || fill === CHART.green;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#fff"
        strokeWidth={2}
        rx={4}
      />
      {width > 48 && height > 28 ? (
        <text
          x={x + 8}
          y={y + 18}
          fill={dark ? "#fafafa" : CHART.ink}
          fontSize={11}
          fontWeight={600}
        >
          {name.length > 14 ? `${name.slice(0, 12)}…` : name}
        </text>
      ) : null}
    </g>
  );
}

export function BrandTreemap({ data }: { data: Node[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No category revenue yet
      </p>
    );
  }

  return (
    <div className="h-52 w-full animate-in fade-in duration-500">
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="size"
          nameKey="name"
          stroke="#fff"
          content={<TreemapContent />}
        >
          <Tooltip
            contentStyle={chartTooltipStyle}
            formatter={(v) => [
              Number(v).toLocaleString("en-AU", {
                style: "currency",
                currency: "AUD",
                maximumFractionDigits: 0,
              }),
              "Billed",
            ]}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}

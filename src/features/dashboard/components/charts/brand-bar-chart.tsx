"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART, chartTooltipProps } from "./theme";

export function BrandBarChart({
  data,
  xKey,
  yKey,
  horizontal,
  formatY,
  yAxisWidth,
  barColors,
  showLabels = true,
  footerNote,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  horizontal?: boolean;
  formatY?: (n: number) => string;
  yAxisWidth?: number;
  /** @deprecated Prefer footerNote for readable captions */
  xAxisLabel?: string;
  yAxisLabel?: string;
  barColors?: string[];
  showLabels?: boolean;
  footerNote?: string;
}) {
  if (data.length === 0) {
    return (
      <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No data yet
      </p>
    );
  }

  const safeData = data.map((row) => {
    const raw = Number(row[yKey]);
    return {
      ...row,
      [yKey]: Number.isFinite(raw) ? raw : 0,
    };
  });
  const maxVal = Math.max(
    0,
    ...safeData.map((row) => Number(row[yKey]) || 0),
  );

  const tick = { fill: "#3f3f46", fontSize: 12, fontWeight: 600 };
  const formatLabel = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    if (n === 0) return "";
    if (formatY) return formatY(n);
    return String(n);
  };
  const formatTick = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    if (formatY) return formatY(n);
    return String(n);
  };
  const angled = !horizontal && safeData.length >= 8;
  const barMax = safeData.length <= 6 ? 56 : 40;

  return (
    <div className="w-full animate-in fade-in duration-500">
      <div className={horizontal ? "h-56" : "h-60"}>
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <BarChart
            data={safeData}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{
              top: horizontal ? 8 : 24,
              right: horizontal ? 48 : 16,
              left: horizontal ? 8 : 12,
              bottom: horizontal ? 8 : angled ? 52 : 44,
            }}
          >
            <CartesianGrid stroke={CHART.zinc200} strokeDasharray="3 3" />
            {horizontal ? (
              <>
                <XAxis
                  type="number"
                  tick={tick}
                  tickFormatter={formatTick}
                  axisLine={false}
                  allowDecimals={false}
                  domain={[0, Math.max(1, maxVal)]}
                />
                <YAxis
                  type="category"
                  dataKey={xKey}
                  width={yAxisWidth ?? 96}
                  tick={tick}
                  axisLine={false}
                  interval={0}
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={xKey}
                  tick={tick}
                  axisLine={false}
                  interval={0}
                  angle={angled ? -40 : 0}
                  textAnchor={angled ? "end" : "middle"}
                  height={angled ? 56 : 36}
                  minTickGap={0}
                />
                <YAxis
                  tick={tick}
                  tickFormatter={formatTick}
                  axisLine={false}
                  width={48}
                  domain={[0, Math.max(1, maxVal)]}
                />
              </>
            )}
            <Tooltip
              {...chartTooltipProps}
              formatter={(v) => {
                const n = Number(v);
                const text = !Number.isFinite(n)
                  ? "—"
                  : formatY
                    ? formatY(n)
                    : String(n);
                return [text, "Value"];
              }}
              labelFormatter={(label, payload) => {
                const period = payload?.[0]?.payload?.period;
                return period ? `${label} · week of ${period}` : String(label);
              }}
            />
            <Bar
              dataKey={yKey}
              fill={CHART.yellow}
              radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={barMax}
              minPointSize={0}
              isAnimationActive={false}
            >
              {barColors
                ? safeData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={barColors[i % barColors.length] ?? CHART.yellow}
                    />
                  ))
                : null}
              {showLabels && maxVal > 0 ? (
                <LabelList
                  dataKey={yKey}
                  position={horizontal ? "right" : "top"}
                  fill="#3f3f46"
                  fontSize={10}
                  fontWeight={600}
                  content={(props) => {
                    const {
                      x,
                      y,
                      width,
                      height,
                      value,
                    } = props as {
                      x?: number;
                      y?: number;
                      width?: number;
                      height?: number;
                      value?: unknown;
                    };
                    const nx = Number(x);
                    const ny = Number(y);
                    const nw = Number(width);
                    const nh = Number(height);
                    if (
                      ![nx, ny, nw, nh].every((n) => Number.isFinite(n))
                    ) {
                      return null;
                    }
                    const label = formatLabel(value);
                    if (!label) return null;
                    const tx = horizontal ? nx + Math.max(0, nw) + 6 : nx + nw / 2;
                    const ty = horizontal ? ny + nh / 2 : ny - 6;
                    if (![tx, ty].every((n) => Number.isFinite(n))) return null;
                    return (
                      <text
                        x={tx}
                        y={ty}
                        fill="#3f3f46"
                        fontSize={10}
                        fontWeight={600}
                        textAnchor={horizontal ? "start" : "middle"}
                        dominantBaseline="middle"
                      >
                        {label}
                      </text>
                    );
                  }}
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {footerNote ? (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          {footerNote}
        </p>
      ) : null}
    </div>
  );
}

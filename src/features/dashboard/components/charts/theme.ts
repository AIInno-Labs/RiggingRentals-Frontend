export const CHART = {
  yellow: "#f5d400",
  ink: "#111111",
  red: "#b42318",
  green: "#2f6f4e",
  zinc400: "#a1a1aa",
  zinc500: "#71717a",
  zinc600: "#52525b",
  zinc200: "#e4e4e7",
  zinc100: "#f4f4f5",
  white: "#ffffff",
  palette: ["#f5d400", "#111111", "#71717a", "#2f6f4e", "#b42318", "#a1a1aa"],
} as const;

export const chartTooltipStyle = {
  backgroundColor: "#111111",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  fontSize: 12,
  color: "#fafafa",
} as const;

export const chartTooltipLabelStyle = { color: "#fafafa" } as const;
export const chartTooltipItemStyle = { color: "#fafafa" } as const;

export const chartTooltipProps = {
  contentStyle: chartTooltipStyle,
  labelStyle: chartTooltipLabelStyle,
  itemStyle: chartTooltipItemStyle,
} as const;

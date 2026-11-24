import { ImageResponse } from "next/og";

export const size = { width: 48, height: 48 };
export const contentType = "image/png";

/** Square brand mark — yellow / black split like the wordmark. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "50%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f5d400",
            color: "#111111",
            fontSize: 26,
            fontWeight: 800,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          R
        </div>
        <div
          style={{
            width: "50%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#111111",
            color: "#f5d400",
            fontSize: 26,
            fontWeight: 800,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          R
        </div>
      </div>
    ),
    { ...size },
  );
}

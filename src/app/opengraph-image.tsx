import { ImageResponse } from "next/og";

export const alt = "Rigging Rentals";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** WhatsApp / Slack / iMessage link preview — not the 32px favicon. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#121212",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* lattice hint */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            opacity: 0.18,
            backgroundImage:
              "linear-gradient(#f5d400 1px, transparent 1px), linear-gradient(90deg, #f5d400 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 12,
            background: "#f5d400",
          }}
        />

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "72px 80px",
            gap: 48,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                width: 160,
                height: 160,
                marginBottom: 40,
                overflow: "hidden",
                borderRadius: 16,
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
                  fontSize: 84,
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
                  fontSize: 84,
                  fontWeight: 800,
                  border: "4px solid #f5d400",
                  borderLeft: "none",
                  fontFamily: "ui-sans-serif, system-ui, sans-serif",
                }}
              >
                R
              </div>
            </div>

            <div
              style={{
                display: "flex",
                fontSize: 72,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.03em",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                lineHeight: 1.05,
              }}
            >
              Rigging Rentals
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 20,
                fontSize: 32,
                color: "#cccccc",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                lineHeight: 1.35,
              }}
            >
              Equipment rental operations for sales, workshop, and finance
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              height: "100%",
              paddingBottom: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                background: "#f5d400",
                color: "#111111",
                fontSize: 28,
                fontWeight: 700,
                padding: "16px 28px",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
              }}
            >
              Yard access
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

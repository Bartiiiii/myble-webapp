import { ImageResponse } from "next/og";

// Branded social-share image, generated at build time (no static asset needed).
export const alt = "Myble — nábytek na míru přesně na centimetr";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ece7df",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* Myble mark — "The Exact Fit" (public/brand/myble-mark.svg) */}
          <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
            <rect x="7.5" y="7.5" width="33" height="33" rx="8.5" stroke="#18181B" strokeWidth="3.75" />
            <path d="M27.75 7.5 V40.5" stroke="#18181B" strokeWidth="3.75" />
            <path d="M7.5 28.5 H27.75" stroke="#18181B" strokeWidth="3.75" />
            <path d="M27.75 19.5 H40.5" stroke="#18181B" strokeWidth="3.75" />
            <rect x="30.4" y="10.15" width="7.45" height="6.6" rx="2" fill="#4F46E5" />
          </svg>
          <div style={{ fontSize: "44px", fontWeight: 600, color: "#18181b", letterSpacing: "-1px" }}>myble</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "76px", fontWeight: 700, color: "#18181b", lineHeight: 1.05 }}>
            Nábytek na míru
          </div>
          <div style={{ fontSize: "76px", fontWeight: 700, color: "#4f46e5", lineHeight: 1.05 }}>
            přesně na centimetr
          </div>
          <div style={{ fontSize: "34px", color: "#52525b", marginTop: "28px" }}>
            Navrhněte za 5 minut · sestavte za 30 · bez truhláře a bez čekání
          </div>
        </div>

        <div style={{ fontSize: "28px", color: "#71717a" }}>Vyrobeno v ČR · my-ble.eu</div>
      </div>
    ),
    { ...size },
  );
}

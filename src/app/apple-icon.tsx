import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — >_ in Alfred Amber */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0A0B",
          borderRadius: 36,
          color: "#F5A524",
          fontSize: 88,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontWeight: 700,
          letterSpacing: "-0.06em",
          lineHeight: 1,
        }}
      >
        {">_"}
      </div>
    ),
    { ...size },
  );
}

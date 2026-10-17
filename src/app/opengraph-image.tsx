import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

// Imagen que se ve al compartir el enlace (WhatsApp, Instagram, Facebook).
export const alt = `${siteConfig.name}: maquillaje profesional`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px",
        background: "linear-gradient(135deg, #fdf2f6 0%, #f6d5e2 100%)",
        color: "#2a1520",
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 700, color: "#9b1c4a" }}>{siteConfig.name}</div>
      <div style={{ fontSize: 40, marginTop: 24 }}>Maquillaje profesional para cada ocasión</div>
      <div style={{ fontSize: 30, marginTop: 40, color: "#5c3a48" }}>
        Agenda en línea · Tienda · Portafolio
      </div>
    </div>,
    size,
  );
}

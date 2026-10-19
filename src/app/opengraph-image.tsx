import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

// Imagen que se ve al compartir el enlace (WhatsApp, Instagram, Facebook).
export const alt = `${siteConfig.name}: ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Colores de la marca (los mismos de globals.css, en hex porque aquí no hay CSS).
const IVORY = "#fcf6ee";
const BURGUNDY = "#79243f";
const PLUM = "#321226";
const GOLD = "#d9b06b";

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
        background: `radial-gradient(circle at 15% 10%, #fbdcdd 0%, ${IVORY} 55%)`,
        color: PLUM,
        borderBottom: `16px solid ${BURGUNDY}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 64, height: 2, background: GOLD }} />
        <div style={{ fontSize: 26, letterSpacing: 8, color: "#8a5f28" }}>
          ESTUDIO BOUTIQUE DE MAQUILLAJE
        </div>
      </div>
      <div style={{ fontSize: 96, letterSpacing: 12, marginTop: 28, color: BURGUNDY }}>
        {siteConfig.name.toUpperCase()}
      </div>
      <div style={{ fontSize: 56, marginTop: 12, fontStyle: "italic" }}>{siteConfig.tagline}</div>
      <div style={{ fontSize: 30, marginTop: 40, color: "#6b535e" }}>
        Novias · Eventos sociales · Asesorías · Tienda
      </div>
    </div>,
    size,
  );
}

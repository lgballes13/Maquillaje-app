import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl, cn } from "./utils";

describe("cn", () => {
  it("resuelve clases de Tailwind en conflicto quedándose con la última", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("buildWhatsAppUrl", () => {
  it("arma el enlace con el mensaje codificado", () => {
    expect(buildWhatsAppUrl("573001234567", "Hola, ¿tienen cita?")).toBe(
      "https://wa.me/573001234567?text=Hola%2C+%C2%BFtienen+cita%3F",
    );
  });

  it("funciona sin mensaje", () => {
    expect(buildWhatsAppUrl("573001234567")).toBe("https://wa.me/573001234567");
  });
});

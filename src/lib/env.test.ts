import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SITE_URL: "https://ejemplo.com",
  NEXT_PUBLIC_BUSINESS_NAME: "Estudio Ejemplo",
};

describe("parsePublicEnv", () => {
  it("acepta la configuración mínima válida", () => {
    expect(parsePublicEnv(valid)).toMatchObject(valid);
  });

  it("trata las cadenas vacías como no definidas", () => {
    const env = parsePublicEnv({ ...valid, NEXT_PUBLIC_WHATSAPP_NUMBER: "" });
    expect(env.NEXT_PUBLIC_WHATSAPP_NUMBER).toBeUndefined();
  });

  it("rechaza una URL del sitio inválida con un mensaje en español", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "no-es-url" })).toThrow(
      /Variables de entorno inválidas/,
    );
  });

  it("rechaza números de WhatsApp con símbolos o espacios", () => {
    expect(() =>
      parsePublicEnv({ ...valid, NEXT_PUBLIC_WHATSAPP_NUMBER: "+57 300 123 4567" }),
    ).toThrow(/solo dígitos/);
  });

  it("acepta los datos del responsable y valida el correo de contacto", () => {
    const env = parsePublicEnv({
      ...valid,
      NEXT_PUBLIC_CONTACT_EMAIL: "hola@estudio.co",
      NEXT_PUBLIC_BUSINESS_LEGAL_ID: "NIT 900.123.456-7",
    });
    expect(env.NEXT_PUBLIC_CONTACT_EMAIL).toBe("hola@estudio.co");
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_CONTACT_EMAIL: "no-es-correo" })).toThrow(
      /correo válido/,
    );
  });
});

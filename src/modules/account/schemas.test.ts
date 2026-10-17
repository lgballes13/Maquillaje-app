import { describe, expect, it } from "vitest";
import { closeAccountErrorMessage, closeAccountSchema } from "./schemas";

describe("closeAccountSchema", () => {
  it("pide la contraseña y la palabra de confirmación", () => {
    expect(closeAccountSchema.safeParse({ password: "x", confirmation: "ELIMINAR" }).success).toBe(
      true,
    );
    expect(
      closeAccountSchema.safeParse({ password: "x", confirmation: " eliminar " }).success,
    ).toBe(true);
    expect(closeAccountSchema.safeParse({ password: "x", confirmation: "borrar" }).success).toBe(
      false,
    );
    expect(closeAccountSchema.safeParse({ password: "", confirmation: "ELIMINAR" }).success).toBe(
      false,
    );
  });
});

describe("closeAccountErrorMessage", () => {
  it("explica por qué no se puede cerrar la cuenta", () => {
    expect(closeAccountErrorMessage("active_appointments")).toContain("cita pendiente");
    expect(closeAccountErrorMessage("open_orders")).toContain("pedido en curso");
    expect(closeAccountErrorMessage("otro")).toContain("No pudimos");
  });
});

import { describe, expect, it } from "vitest";
import { safeFormValues } from "./forms";

describe("safeFormValues", () => {
  it("nunca devuelve contraseñas ni códigos 2FA", () => {
    const data = new FormData();
    data.set("email", "ana@correo.com");
    data.set("password", "secreta");
    data.set("confirmPassword", "secreta");
    data.set("code", "123456");
    data.set("$ACTION_ID_abc", "");
    expect(safeFormValues(data)).toEqual({ email: "ana@correo.com" });
  });
});

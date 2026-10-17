import { describe, expect, it } from "vitest";
import {
  normalizePhone,
  signInSchema,
  signUpSchema,
  totpCodeSchema,
  updatePasswordSchema,
} from "./schemas";

const validSignUp = {
  fullName: "  Ana Pérez ",
  email: " ANA@Correo.com ",
  phone: "300 123 4567",
  password: "una frase larga segura",
  privacyAccepted: "on",
};

describe("signUpSchema", () => {
  it("acepta un registro válido y limpia los datos", () => {
    const result = signUpSchema.parse(validSignUp);
    expect(result).toMatchObject({
      fullName: "Ana Pérez",
      email: "ana@correo.com",
      phone: "+573001234567",
      privacyAccepted: true,
      marketingOptIn: false,
    });
  });

  it("exige la autorización de tratamiento de datos (Ley 1581)", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, privacyAccepted: undefined });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/autorizar el tratamiento/);
  });

  it("rechaza contraseñas de menos de 12 caracteres", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: "corta123" });
    expect(result.error?.issues[0]?.message).toMatch(/al menos 12/);
  });

  it("rechaza contraseñas de más de 128 caracteres", () => {
    const result = signUpSchema.safeParse({ ...validSignUp, password: "a".repeat(129) });
    expect(result.success).toBe(false);
  });

  it("el celular es opcional", () => {
    const result = signUpSchema.parse({ ...validSignUp, phone: "" });
    expect(result.phone).toBeUndefined();
  });

  it("rechaza un celular inválido", () => {
    expect(signUpSchema.safeParse({ ...validSignUp, phone: "12" }).success).toBe(false);
  });
});

describe("normalizePhone", () => {
  it.each([
    ["300 123 4567", "+573001234567"],
    ["+57 300-123-4567", "+573001234567"],
    ["(300) 1234567", "+573001234567"],
    ["+1 305 555 0100", "+13055550100"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});

describe("signInSchema", () => {
  it("no valida el largo de la contraseña (para no dar pistas)", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
});

describe("updatePasswordSchema", () => {
  it("exige que las contraseñas coincidan", () => {
    const result = updatePasswordSchema.safeParse({
      password: "una frase larga segura",
      confirmPassword: "otra frase distinta",
    });
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });
});

describe("totpCodeSchema", () => {
  it.each(["123456", " 654321 "])("acepta %s", (code) => {
    expect(totpCodeSchema.safeParse({ code }).success).toBe(true);
  });
  it.each(["12345", "1234567", "abcdef"])("rechaza %s", (code) => {
    expect(totpCodeSchema.safeParse({ code }).success).toBe(false);
  });
});

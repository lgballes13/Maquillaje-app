import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it.each(["/cuenta", "/admin/reglas", "/tienda?categoria=labiales"])(
    "acepta la ruta interna %s",
    (path) => {
      expect(safeRedirectPath(path)).toBe(path);
    },
  );

  it.each([
    "https://sitio-malicioso.com",
    "//sitio-malicioso.com",
    "/\\sitio-malicioso.com",
    "javascript:alert(1)",
    "/cuenta\nSet-Cookie: x=1",
    "",
    undefined,
    123,
  ])("rechaza %s y usa la ruta por defecto", (value) => {
    expect(safeRedirectPath(value)).toBe("/cuenta");
  });

  it("permite elegir la ruta por defecto", () => {
    expect(safeRedirectPath(null, "/admin")).toBe("/admin");
  });
});

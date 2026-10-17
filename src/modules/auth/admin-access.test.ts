import { describe, expect, it } from "vitest";
import { decideAdminAccess } from "./admin-access";

describe("decideAdminAccess", () => {
  const admin = { isLoggedIn: true, hasAdminRole: true };

  it("sin sesión → ingresar", () => {
    expect(
      decideAdminAccess({
        isLoggedIn: false,
        hasAdminRole: false,
        currentLevel: null,
        nextLevel: null,
      }),
    ).toBe("login");
  });

  it("clienta sin rol admin → prohibido, aunque tenga 2FA", () => {
    expect(
      decideAdminAccess({
        isLoggedIn: true,
        hasAdminRole: false,
        currentLevel: "aal2",
        nextLevel: "aal2",
      }),
    ).toBe("forbidden");
  });

  it("admin sin segundo factor configurado → configurarlo", () => {
    expect(decideAdminAccess({ ...admin, currentLevel: "aal1", nextLevel: "aal1" })).toBe("enroll");
  });

  it("admin con segundo factor pero sin usarlo en esta sesión → pedir código", () => {
    expect(decideAdminAccess({ ...admin, currentLevel: "aal1", nextLevel: "aal2" })).toBe("verify");
  });

  it("admin con sesión verificada con segundo factor → acceso", () => {
    expect(decideAdminAccess({ ...admin, currentLevel: "aal2", nextLevel: "aal2" })).toBe("allow");
  });
});

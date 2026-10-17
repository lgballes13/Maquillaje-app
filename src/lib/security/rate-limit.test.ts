import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const { rateLimitKey } = await import("./rate-limit");

describe("rateLimitKey", () => {
  it("no guarda el correo en texto plano (usa un hash)", () => {
    const key = rateLimitKey("login:email", "ana@correo.com");
    expect(key).toMatch(/^login:email:[a-f0-9]{64}$/);
    expect(key).not.toContain("ana");
  });

  it("ignora mayúsculas y espacios para que no se pueda evadir el límite", () => {
    expect(rateLimitKey("login:email", " ANA@correo.com ")).toBe(
      rateLimitKey("login:email", "ana@correo.com"),
    );
  });

  it("separa los contadores por acción", () => {
    expect(rateLimitKey("login:ip", "1.2.3.4")).not.toBe(rateLimitKey("signup:ip", "1.2.3.4"));
  });
});

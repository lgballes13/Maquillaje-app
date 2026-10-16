import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "./csp";

describe("buildCsp", () => {
  it("incluye el nonce y bloquea objetos e iframes en producción", () => {
    const csp = buildCsp({ nonce: "abc123", isDev: false });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("nunca permite unsafe-eval ni unsafe-inline en scripts de producción", () => {
    const csp = buildCsp({ nonce: "n", isDev: false });
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("unsafe-inline");
  });

  it("permite unsafe-eval solo en desarrollo", () => {
    expect(buildCsp({ nonce: "n", isDev: true })).toContain("'unsafe-eval'");
  });

  it("agrega el origen de Supabase (https y wss) cuando está configurado", () => {
    const csp = buildCsp({
      nonce: "n",
      isDev: false,
      supabaseUrl: "https://proyecto.supabase.co/rest/v1",
    });
    expect(csp).toContain(
      "connect-src 'self' https://proyecto.supabase.co wss://proyecto.supabase.co",
    );
    expect(csp).toContain("img-src 'self' blob: data: https://proyecto.supabase.co");
  });
});

describe("generateNonce", () => {
  it("genera valores distintos en cada llamada", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => generateNonce()));
    expect(nonces.size).toBe(50);
  });

  it("genera base64 de 16 bytes (24 caracteres)", () => {
    expect(generateNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

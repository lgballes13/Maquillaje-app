import { test as base, expect } from "@playwright/test";

/**
 * Cada prueba simula venir de una IP distinta (encabezado x-forwarded-for).
 * Así el límite de intentos de una prueba no bloquea a las demás.
 * En Vercel este encabezado lo pone la plataforma y el cliente no puede falsearlo.
 */
function randomIp(): string {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

export const test = base.extend({
  extraHTTPHeaders: async ({}, provide) => {
    await provide({ "x-forwarded-for": randomIp() });
  },
});

export { expect };

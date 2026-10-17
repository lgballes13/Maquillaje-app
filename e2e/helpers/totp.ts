import { createHmac } from "node:crypto";

/**
 * Genera códigos TOTP (los mismos 6 números que muestra Google Authenticator)
 * a partir de la clave secreta. Así las pruebas pueden completar el 2FA.
 * Implementa el estándar RFC 6238 (SHA-1, 30 segundos, 6 dígitos).
 */
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value === -1) throw new Error(`Carácter base32 inválido: ${char}`);
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totpStep(now = Date.now()): number {
  return Math.floor(now / 1000 / 30);
}

export function generateTotp(secret: string, step = totpStep()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

/** Espera a que cambie la ventana de 30 s para no reutilizar un código ya usado. */
export async function nextFreshTotp(secret: string, usedStep: number): Promise<string> {
  while (totpStep() <= usedStep) await new Promise((r) => setTimeout(r, 500));
  return generateTotp(secret);
}

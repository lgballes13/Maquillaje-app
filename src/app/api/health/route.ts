import { NextResponse } from "next/server";

/**
 * Chequeo de salud: responde 200 si la app está viva.
 * Útil para monitoreo y para que las pruebas E2E sepan que el servidor arrancó.
 * No revela versiones ni datos internos.
 */
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}

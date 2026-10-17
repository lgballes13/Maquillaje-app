import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/env.server";
import { sendDueReminders } from "@/modules/notifications/service";

/*
 * Tarea programada: envía los recordatorios de las citas de mañana.
 * Vercel Cron la llama todos los días (ver vercel.json) con el encabezado
 * "Authorization: Bearer <CRON_SECRET>". Sin ese secreto responde 401.
 */

function authorized(request: Request, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function GET(request: Request) {
  const secret = getCronSecret();
  if (!secret || !authorized(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const sent = await sendDueReminders();
    return NextResponse.json({ sent });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

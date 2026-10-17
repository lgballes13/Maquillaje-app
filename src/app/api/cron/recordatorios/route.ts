import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDueReminders } from "@/modules/notifications/service";

/*
 * Tarea programada diaria: envía los recordatorios de las citas de mañana y
 * registra como «vencido» el saldo a favor que ya venció.
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
    const { data: expiredCredits, error } = await createAdminClient().rpc("expire_credits");
    if (error) throw new Error(`No se pudo vencer el saldo a favor: ${error.message}`);
    return NextResponse.json({ sent, expiredCredits });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

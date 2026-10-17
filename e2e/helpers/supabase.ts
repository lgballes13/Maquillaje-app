import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Utilidades de prueba que usan la llave service_role de Supabase LOCAL.
 * Nunca se usan contra producción: las variables vienen de `supabase status`.
 */
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  if (!/127\.0\.0\.1|localhost/.test(url))
    throw new Error("Las pruebas E2E solo corren contra Supabase local");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const TEST_PASSWORD = "ClaveDePrueba123";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@demo.example`;
}

/** Crea un usuario confirmado. Con admin=true le asigna el rol de administrador. */
export async function createTestUser({ admin = false, name = "Persona de Prueba" } = {}) {
  const email = uniqueEmail(admin ? "admin" : "cliente");
  const supabase = adminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      privacy_accepted: true,
      privacy_policy_version: "2026-10-16",
    },
  });
  if (error || !data.user) throw error ?? new Error("No se creó el usuario");
  if (admin) {
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({ user_id: data.user.id, role: "admin" });
    if (roleError) throw roleError;
  }
  return { id: data.user.id, email, password: TEST_PASSWORD };
}

/** Política vigente (la que aceptan las citas que se crean con insertAppointment). */
export async function currentRules() {
  const { data, error } = await adminClient()
    .from("business_rules")
    .select("version, free_cancellation_hours, reschedule_window_hours, reschedule_penalty_percent")
    .order("version", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return { ...data, reschedule_penalty_percent: Number(data.reschedule_penalty_percent) };
}

/**
 * Crea una cita confirmada directo en la base, a la hora que la prueba
 * necesite (incluso en el pasado), sin pasar por el flujo de reserva.
 * `hoursFromNow` se redondea a 5 minutos y se corre al azar hasta `jitterHours`
 * (hacia el futuro, o hacia el pasado si es negativo), para que las pruebas en
 * paralelo no choquen; si aun así choca con otra cita, se reintenta.
 */
export async function insertAppointment({
  customerId,
  hoursFromNow,
  jitterHours = 3,
  depositCop = 180_000,
}: {
  customerId: string;
  hoursFromNow: number;
  jitterHours?: number;
  depositCop?: number;
}) {
  const supabase = adminClient();
  const [{ data: service, error: serviceError }, rules] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cop")
      .eq("name", "Maquillaje social")
      .single(),
    currentRules(),
  ]);
  if (serviceError) throw serviceError;

  const FIVE_MIN = 5 * 60 * 1000;
  for (let attempt = 0; attempt < 20; attempt++) {
    const jitter = Math.floor(Math.random() * jitterHours * 12) * FIVE_MIN;
    const target = Date.now() + hoursFromNow * 3_600_000 + (hoursFromNow >= 0 ? jitter : -jitter);
    const startsAt = new Date(Math.floor(target / FIVE_MIN) * FIVE_MIN);
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60_000);
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        customer_id: customerId,
        service_id: service.id,
        service_name: service.name,
        duration_minutes: service.duration_minutes,
        price_cop: service.price_cop,
        rules_version: rules.version,
        deposit_percent: Math.round((depositCop / service.price_cop) * 10000) / 100,
        deposit_cop: depositCop,
        policy_accepted_at: new Date().toISOString(),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        blocked_until: new Date(endsAt.getTime() + 15 * 60_000).toISOString(),
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .select("id, starts_at")
      .single();
    if (!error) return { id: data.id as string, startsAt: new Date(data.starts_at), rules };
    if (error.code !== "23P01") throw error; // 23P01: choca con otra cita
  }
  throw new Error("No se encontró un horario libre para la cita de prueba");
}

/** Cancela una cita directo en la base (limpieza al final de una prueba). */
export async function cancelAppointmentInDb(id: string) {
  const { error } = await adminClient()
    .from("appointments")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

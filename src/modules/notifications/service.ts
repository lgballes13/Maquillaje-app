import "server-only";
import { siteConfig } from "@/config/site";
import { sendEmail } from "@/lib/email";
import { formatFullDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, toZonedDateString, zonedDateTimeToUtc } from "@/lib/time";
import {
  appointmentConfirmedEmail,
  appointmentReminderEmail,
  type AppointmentEmailData,
} from "./emails";

/*
 * Correos de citas. Usan la llave service_role porque se disparan desde el
 * webhook y desde la tarea programada, donde no hay sesión de la clienta.
 * Cada correo se "reserva" primero en la base (confirmation_sent_at /
 * reminder_sent_at) para no enviarlo dos veces aunque lleguen avisos repetidos.
 */

type ClaimedAppointment = {
  id: string;
  customer_id: string;
  service_name: string;
  starts_at: string;
  price_cop: number;
  deposit_cop: number;
};

async function emailData(appointment: ClaimedAppointment): Promise<{
  to: string;
  data: AppointmentEmailData;
} | null> {
  const supabase = createAdminClient();
  const [{ data: user }, { data: profile }] = await Promise.all([
    supabase.auth.admin.getUserById(appointment.customer_id),
    supabase.from("profiles").select("full_name").eq("id", appointment.customer_id).maybeSingle(),
  ]);
  const to = user.user?.email;
  if (!to) return null;
  return {
    to,
    data: {
      businessName: siteConfig.name,
      customerName: profile?.full_name ?? null,
      serviceName: appointment.service_name,
      when: formatFullDateTime(appointment.starts_at),
      depositCop: appointment.deposit_cop,
      balanceCop: appointment.price_cop - appointment.deposit_cop,
      appointmentUrl: `${siteConfig.url}/citas/${appointment.id}`,
      whatsappNumber: siteConfig.whatsappNumber,
    },
  };
}

const COLUMNS = "id, customer_id, service_name, starts_at, price_cop, deposit_cop";

/** Envía la confirmación de una cita (una sola vez). Nunca lanza errores. */
export async function sendConfirmationEmail(appointmentId: string): Promise<void> {
  try {
    const { data: claimed } = await createAdminClient()
      .from("appointments")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .eq("status", "confirmed")
      .is("confirmation_sent_at", null)
      .select(COLUMNS)
      .maybeSingle();
    if (!claimed) return;
    const message = await emailData(claimed);
    if (message) await sendEmail({ to: message.to, ...appointmentConfirmedEmail(message.data) });
  } catch (error) {
    console.error("No se pudo enviar la confirmación de la cita", error);
  }
}

/**
 * Recordatorios de las citas confirmadas de MAÑANA (día del negocio).
 * La tarea programada la llama una vez al día.
 */
export async function sendDueReminders(now = new Date()): Promise<number> {
  const supabase = createAdminClient();
  const tomorrow = addDays(toZonedDateString(now, siteConfig.timeZone), 1);
  const from = zonedDateTimeToUtc(tomorrow, "00:00", siteConfig.timeZone).toISOString();
  const to = zonedDateTimeToUtc(addDays(tomorrow, 1), "00:00", siteConfig.timeZone).toISOString();

  const { data: due, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("status", "confirmed")
    .is("reminder_sent_at", null)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .limit(200);
  if (error) throw new Error(`No se pudieron consultar los recordatorios: ${error.message}`);

  let sent = 0;
  for (const { id } of due) {
    const { data: claimed } = await supabase
      .from("appointments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", id)
      .is("reminder_sent_at", null)
      .select(COLUMNS)
      .maybeSingle();
    if (!claimed) continue;
    const message = await emailData(claimed);
    if (
      message &&
      (await sendEmail({ to: message.to, ...appointmentReminderEmail(message.data) }))
    ) {
      sent++;
    }
  }
  return sent;
}

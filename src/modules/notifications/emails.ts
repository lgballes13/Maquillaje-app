import { formatCop } from "@/modules/booking/policy";

/*
 * Plantillas de correo. Son funciones puras (fáciles de probar). Todo dato que
 * venga de la base o de la clienta se escapa antes de ir al HTML.
 */

export interface AppointmentEmailData {
  businessName: string;
  customerName: string | null;
  serviceName: string;
  /** Fecha y hora ya formateadas en la zona del negocio. */
  when: string;
  depositCop: number;
  balanceCop: number;
  appointmentUrl: string;
  whatsappNumber?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(title: string, paragraphs: string[], cta: { label: string; url: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 12px">${p}</p>`).join("");
  return `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f7f3f5;font-family:Arial,sans-serif;color:#211a1d">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${title}</h1>${body}
<p style="margin:20px 0 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#9b1f55;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px">${cta.label}</a></p>
</div></body></html>`;
}

function greeting(name: string | null) {
  return name ? `Hola, ${name}:` : "Hola:";
}

export function appointmentConfirmedEmail(data: AppointmentEmailData) {
  const subject = `Tu cita quedó confirmada · ${data.businessName}`;
  const lines = [
    greeting(data.customerName),
    `Tu cita de ${data.serviceName} quedó confirmada para el ${data.when}.`,
    `Anticipo: ${formatCop(data.depositCop)}. El día de la cita pagas ${formatCop(data.balanceCop)}.`,
    "Si necesitas cambiar el horario o cancelar, hazlo desde tu cita en la página.",
  ];
  return {
    subject,
    text: `${lines.join("\n\n")}\n\nVer mi cita: ${data.appointmentUrl}`,
    html: layout("Tu cita quedó confirmada", lines.map(escapeHtml), {
      label: "Ver mi cita",
      url: data.appointmentUrl,
    }),
  };
}

export function appointmentReminderEmail(data: AppointmentEmailData) {
  const subject = `Recordatorio: tu cita es mañana · ${data.businessName}`;
  const lines = [
    greeting(data.customerName),
    `Te recordamos tu cita de ${data.serviceName} el ${data.when}.`,
    `El día de la cita pagas ${formatCop(data.balanceCop)}.`,
    ...(data.whatsappNumber
      ? [`¿Alguna pregunta? Escríbenos por WhatsApp al +${data.whatsappNumber}.`]
      : []),
  ];
  return {
    subject,
    text: `${lines.join("\n\n")}\n\nVer mi cita: ${data.appointmentUrl}`,
    html: layout("Tu cita es mañana", lines.map(escapeHtml), {
      label: "Ver mi cita",
      url: data.appointmentUrl,
    }),
  };
}

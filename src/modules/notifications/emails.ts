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

export interface OrderEmailData {
  businessName: string;
  customerName: string | null;
  orderNumber: number;
  items: { name: string; quantity: number; lineTotalCop: number }[];
  subtotalCop: number;
  shippingCop: number;
  totalCop: number;
  delivery: "pickup" | "shipping";
  /** Dirección y ciudad (solo envío). */
  address: string | null;
  orderUrl: string;
  whatsappNumber?: string;
}

export function orderPaidEmail(data: OrderEmailData) {
  const subject = `Recibimos el pago de tu pedido #${data.orderNumber} · ${data.businessName}`;
  const lines = [
    greeting(data.customerName),
    `Recibimos el pago de tu pedido #${data.orderNumber}.`,
    ...data.items.map((item) => `${item.quantity} × ${item.name}: ${formatCop(item.lineTotalCop)}`),
    data.shippingCop > 0
      ? `Productos: ${formatCop(data.subtotalCop)}. Envío: ${formatCop(data.shippingCop)}. Total pagado: ${formatCop(data.totalCop)}.`
      : `Total pagado: ${formatCop(data.totalCop)}.`,
    data.delivery === "pickup"
      ? "Te avisamos cuando esté listo para recoger en el estudio."
      : `Lo enviamos a ${data.address ?? "la dirección que nos diste"}. Te avisamos cuando salga.`,
    ...(data.whatsappNumber
      ? [`¿Alguna pregunta? Escríbenos por WhatsApp al +${data.whatsappNumber}.`]
      : []),
  ];
  return {
    subject,
    text: `${lines.join("\n\n")}\n\nVer mi pedido: ${data.orderUrl}`,
    html: layout("Recibimos tu pago", lines.map(escapeHtml), {
      label: "Ver mi pedido",
      url: data.orderUrl,
    }),
  };
}

export interface PreorderEmailData {
  businessName: string;
  customerName: string | null;
  orderNumber: number;
  productName: string;
  quantity: number;
  depositCop: number;
  /** Lo que falta por pagar cuando llegue (incluye el envío). */
  balanceCop: number;
  deliveryDays: number;
  orderUrl: string;
  whatsappNumber?: string;
}

function whatsappLine(number?: string) {
  return number ? [`¿Alguna pregunta? Escríbenos por WhatsApp al +${number}.`] : [];
}

/** Anticipo recibido: el producto queda reservado. */
export function preorderDepositEmail(data: PreorderEmailData) {
  const subject = `Reservaste ${data.productName} · pedido #${data.orderNumber} · ${data.businessName}`;
  const lines = [
    greeting(data.customerName),
    `Recibimos el anticipo de ${formatCop(data.depositCop)} y te reservamos ${data.quantity} × ${data.productName} (pedido #${data.orderNumber}).`,
    `Tiempo estimado de llegada: ${data.deliveryDays} días. Te escribimos apenas llegue.`,
    `Cuando llegue pagas el saldo: ${formatCop(data.balanceCop)}.`,
    ...whatsappLine(data.whatsappNumber),
  ];
  return {
    subject,
    text: `${lines.join("\n\n")}\n\nVer mi pedido: ${data.orderUrl}`,
    html: layout("Tu reserva quedó lista", lines.map(escapeHtml), {
      label: "Ver mi pedido",
      url: data.orderUrl,
    }),
  };
}

/** Llegó el producto reservado: pagar el saldo antes de la fecha límite. */
export function preorderArrivedEmail(
  data: PreorderEmailData & { dueOn: string; balanceDays: number },
) {
  const subject = `Llegó tu ${data.productName}: paga el saldo · ${data.businessName}`;
  const lines = [
    greeting(data.customerName),
    `¡Llegó lo que reservaste! ${data.quantity} × ${data.productName} (pedido #${data.orderNumber}).`,
    `Para recibirlo, paga el saldo de ${formatCop(data.balanceCop)} antes del ${data.dueOn}.`,
    `Si no pagas en ${data.balanceDays} días, liberamos las unidades y tu anticipo de ${formatCop(data.depositCop)} queda como saldo a favor.`,
    ...whatsappLine(data.whatsappNumber),
  ];
  return {
    subject,
    text: `${lines.join("\n\n")}\n\nPagar el saldo: ${data.orderUrl}`,
    html: layout("Llegó tu producto", lines.map(escapeHtml), {
      label: "Pagar el saldo",
      url: data.orderUrl,
    }),
  };
}

export interface WaitlistEmailData {
  businessName: string;
  customerName: string | null;
  productName: string;
  productUrl: string;
}

/** Aviso de la lista de espera: el producto volvió a tener unidades. */
export function waitlistBackInStockEmail(data: WaitlistEmailData) {
  const subject = `Volvió ${data.productName} · ${data.businessName}`;
  const lines = [
    greeting(data.customerName),
    `${data.productName} ya tiene unidades disponibles.`,
    "Las unidades no quedan apartadas hasta que pagas, así que si lo quieres, no esperes mucho.",
    "Te avisamos solo esta vez. Si quieres otro aviso, vuelve a inscribirte en la página del producto.",
  ];
  return {
    subject,
    text: `${lines.join("\n\n")}\n\nVer el producto: ${data.productUrl}`,
    html: layout("Volvió lo que esperabas", lines.map(escapeHtml), {
      label: "Ver el producto",
      url: data.productUrl,
    }),
  };
}

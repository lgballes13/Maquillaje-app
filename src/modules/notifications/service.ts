import "server-only";
import { siteConfig } from "@/config/site";
import { sendEmail } from "@/lib/email";
import { formatDateTime, formatFullDateTime } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, toZonedDateString, zonedDateTimeToUtc } from "@/lib/time";
import {
  appointmentConfirmedEmail,
  appointmentReminderEmail,
  orderPaidEmail,
  preorderArrivedEmail,
  preorderDepositEmail,
  waitlistBackInStockEmail,
  type AppointmentEmailData,
  type PreorderEmailData,
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
 * Confirmación del pago de un pedido de la tienda (una sola vez, igual que las
 * citas: se reserva con confirmation_sent_at). Nunca lanza errores.
 */
export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: order } = await supabase
      .from("orders")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "paid")
      .is("confirmation_sent_at", null)
      .select(
        "id, number, customer_id, delivery_method, address, city, subtotal_cop, shipping_cop, total_cop, order_items(product_name, quantity, line_total_cop)",
      )
      .maybeSingle();
    if (!order) return;
    const [{ data: user }, { data: profile }] = await Promise.all([
      supabase.auth.admin.getUserById(order.customer_id),
      supabase.from("profiles").select("full_name").eq("id", order.customer_id).maybeSingle(),
    ]);
    const to = user.user?.email;
    if (!to) return;
    await sendEmail({
      to,
      ...orderPaidEmail({
        businessName: siteConfig.name,
        customerName: profile?.full_name ?? null,
        orderNumber: order.number,
        items: order.order_items.map((item) => ({
          name: item.product_name,
          quantity: item.quantity,
          lineTotalCop: item.line_total_cop,
        })),
        subtotalCop: order.subtotal_cop,
        shippingCop: order.shipping_cop,
        totalCop: order.total_cop,
        delivery: order.delivery_method,
        address: order.address ? `${order.address}, ${order.city ?? ""}`.replace(/, $/, "") : null,
        orderUrl: `${siteConfig.url}/pedidos/${order.id}`,
        whatsappNumber: siteConfig.whatsappNumber,
      }),
    });
  } catch (error) {
    console.error("No se pudo enviar la confirmación del pedido", error);
  }
}

const PREORDER_COLUMNS =
  "id, number, customer_id, rules_version, total_cop, deposit_cop, balance_due_at, order_items(product_name, quantity)";

type ClaimedPreorder = {
  id: string;
  number: number;
  customer_id: string;
  rules_version: number;
  total_cop: number;
  deposit_cop: number | null;
  balance_due_at: string | null;
  order_items: { product_name: string; quantity: number }[];
};

async function customerContact(customerId: string) {
  const supabase = createAdminClient();
  const [{ data: user }, { data: profile }] = await Promise.all([
    supabase.auth.admin.getUserById(customerId),
    supabase.from("profiles").select("full_name").eq("id", customerId).maybeSingle(),
  ]);
  const to = user.user?.email;
  return to ? { to, name: profile?.full_name ?? null } : null;
}

async function preorderEmailData(order: ClaimedPreorder) {
  const supabase = createAdminClient();
  const [contact, { data: rules }] = await Promise.all([
    customerContact(order.customer_id),
    supabase
      .from("business_rules")
      .select("preorder_delivery_days, preorder_balance_days")
      .eq("version", order.rules_version)
      .single(),
  ]);
  const item = order.order_items[0];
  if (!contact || !rules || !item) return null;
  const deposit = order.deposit_cop ?? 0;
  const data: PreorderEmailData = {
    businessName: siteConfig.name,
    customerName: contact.name,
    orderNumber: order.number,
    productName: item.product_name,
    quantity: item.quantity,
    depositCop: deposit,
    balanceCop: order.total_cop - deposit,
    deliveryDays: rules.preorder_delivery_days,
    orderUrl: `${siteConfig.url}/pedidos/${order.id}`,
    whatsappNumber: siteConfig.whatsappNumber,
  };
  return { to: contact.to, data, balanceDays: rules.preorder_balance_days };
}

/** Correo de «reservaste el producto» (una sola vez, con deposit_email_sent_at). Nunca lanza errores. */
export async function sendPreorderDepositEmail(orderId: string): Promise<void> {
  try {
    const { data: order } = await createAdminClient()
      .from("orders")
      .update({ deposit_email_sent_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("kind", "preorder")
      .eq("status", "deposit_paid")
      .is("deposit_email_sent_at", null)
      .select(PREORDER_COLUMNS)
      .maybeSingle();
    if (!order) return;
    const message = await preorderEmailData(order);
    if (message) await sendEmail({ to: message.to, ...preorderDepositEmail(message.data) });
  } catch (error) {
    console.error("No se pudo enviar el correo de la reserva", error);
  }
}

/** Correo de «llegó tu producto, paga el saldo» (una sola vez). Nunca lanza errores. */
export async function sendPreorderArrivedEmail(orderId: string): Promise<void> {
  try {
    const { data: order } = await createAdminClient()
      .from("orders")
      .update({ arrival_email_sent_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("kind", "preorder")
      .eq("status", "awaiting_balance")
      .is("arrival_email_sent_at", null)
      .select(PREORDER_COLUMNS)
      .maybeSingle();
    if (!order?.balance_due_at) return;
    const message = await preorderEmailData(order);
    if (!message) return;
    await sendEmail({
      to: message.to,
      ...preorderArrivedEmail({
        ...message.data,
        dueOn: formatDateTime(order.balance_due_at),
        balanceDays: message.balanceDays,
      }),
    });
  } catch (error) {
    console.error("No se pudo enviar el aviso de llegada", error);
  }
}

/**
 * Avisa a la lista de espera de un producto que volvió a tener unidades.
 * Cada inscripción se avisa una sola vez (notified_at). Nunca lanza errores.
 */
export async function notifyWaitlist(productId: string): Promise<number> {
  try {
    const supabase = createAdminClient();
    const [{ data: product }, { data: availability }] = await Promise.all([
      supabase.from("products").select("id, name, is_active").eq("id", productId).maybeSingle(),
      supabase.rpc("get_product_availability", { p_product_ids: [productId] }),
    ]);
    const available = availability?.[0]?.available ?? 0;
    if (!product?.is_active || available <= 0) return 0;

    const { data: claimed, error } = await supabase
      .from("product_waitlist")
      .update({ notified_at: new Date().toISOString() })
      .eq("product_id", productId)
      .is("notified_at", null)
      .select("customer_id")
      .limit(500);
    if (error) throw error;

    let sent = 0;
    for (const { customer_id } of claimed) {
      const contact = await customerContact(customer_id);
      if (!contact) continue;
      const ok = await sendEmail({
        to: contact.to,
        ...waitlistBackInStockEmail({
          businessName: siteConfig.name,
          customerName: contact.name,
          productName: product.name,
          productUrl: `${siteConfig.url}/tienda/${product.id}`,
        }),
      });
      if (ok) sent++;
    }
    return sent;
  } catch (error) {
    console.error("No se pudo avisar a la lista de espera", error);
    return 0;
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

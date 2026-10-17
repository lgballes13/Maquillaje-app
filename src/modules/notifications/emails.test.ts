import { describe, expect, it } from "vitest";
import {
  appointmentConfirmedEmail,
  appointmentReminderEmail,
  escapeHtml,
  orderPaidEmail,
  type AppointmentEmailData,
  type OrderEmailData,
} from "./emails";

const data: AppointmentEmailData = {
  businessName: "Estudio de Prueba",
  customerName: "Ana <script>alert(1)</script>",
  serviceName: "Maquillaje social",
  when: "viernes, 16 de octubre de 2026, 10:00 a. m.",
  depositCop: 90000,
  balanceCop: 90000,
  appointmentUrl: "https://ejemplo.com/citas/123?a=1&b=2",
  whatsappNumber: "573001234567",
};

describe("escapeHtml", () => {
  it("escapa los caracteres especiales de HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("appointmentConfirmedEmail", () => {
  it("incluye servicio, fecha, anticipo, saldo y enlace", () => {
    const email = appointmentConfirmedEmail(data);
    expect(email.subject).toBe("Tu cita quedó confirmada · Estudio de Prueba");
    expect(email.text).toContain("Maquillaje social");
    expect(email.text).toContain(data.when);
    expect(email.text).toContain("$ 90.000");
    expect(email.text).toContain(data.appointmentUrl);
  });

  it("escapa los datos de la clienta en el HTML", () => {
    const { html } = appointmentConfirmedEmail(data);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="https://ejemplo.com/citas/123?a=1&amp;b=2"');
  });
});

describe("appointmentReminderEmail", () => {
  it("incluye el WhatsApp solo si está configurado", () => {
    expect(appointmentReminderEmail(data).text).toContain("+573001234567");
    expect(appointmentReminderEmail({ ...data, whatsappNumber: undefined }).text).not.toContain(
      "WhatsApp",
    );
  });

  it("sin nombre saluda de forma genérica", () => {
    expect(appointmentReminderEmail({ ...data, customerName: null }).text.startsWith("Hola:")).toBe(
      true,
    );
  });
});

describe("orderPaidEmail", () => {
  const order: OrderEmailData = {
    businessName: "Estudio de Prueba",
    customerName: "Ana <b>",
    orderNumber: 1024,
    items: [
      { name: "Labial <mate>", quantity: 2, lineTotalCop: 90000 },
      { name: "Set de brochas", quantity: 1, lineTotalCop: 120000 },
    ],
    subtotalCop: 210000,
    shippingCop: 15000,
    totalCop: 225000,
    delivery: "shipping",
    address: "Calle 10 # 20-30, Medellín",
    orderUrl: "https://ejemplo.com/pedidos/abc",
  };

  it("incluye número, productos, envío, total y enlace", () => {
    const email = orderPaidEmail(order);
    expect(email.subject).toContain("#1024");
    expect(email.text).toContain("2 × Labial <mate>");
    expect(email.text).toMatch(/Envío: \$\s?15\.000/);
    expect(email.text).toMatch(/Total pagado: \$\s?225\.000/);
    expect(email.text).toContain("Calle 10 # 20-30, Medellín");
    expect(email.text).toContain(order.orderUrl);
  });

  it("escapa en el HTML los datos que vienen de la base", () => {
    const { html } = orderPaidEmail(order);
    expect(html).toContain("Labial &lt;mate&gt;");
    expect(html).not.toContain("<mate>");
    expect(html).toContain("Ana &lt;b&gt;");
  });

  it("para recoger avisa que se notificará cuando esté listo", () => {
    const email = orderPaidEmail({ ...order, delivery: "pickup", shippingCop: 0, address: null });
    expect(email.text).toContain("listo para recoger");
    expect(email.text).not.toContain("Envío:");
  });
});

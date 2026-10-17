import { describe, expect, it } from "vitest";
import {
  appointmentConfirmedEmail,
  appointmentReminderEmail,
  escapeHtml,
  type AppointmentEmailData,
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

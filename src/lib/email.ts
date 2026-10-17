import "server-only";
import { siteConfig } from "@/config/site";
import { getEmailEnv } from "@/lib/env.server";

/*
 * Envío de correos.
 * - Producción: Resend (RESEND_API_KEY + EMAIL_FROM).
 * - Local y CI: Mailpit, el buzón de pruebas de Supabase (MAILPIT_URL).
 * - Sin ninguno: no envía y lo deja registrado (la app sigue funcionando).
 * Un correo que falla nunca rompe la acción principal (pagar, reservar…).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const env = getEmailEnv();
  try {
    if (env.RESEND_API_KEY && env.EMAIL_FROM) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) console.error("Resend rechazó el correo", res.status);
      return res.ok;
    }

    if (env.MAILPIT_URL) {
      const res = await fetch(`${env.MAILPIT_URL}/api/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: "citas@demo.example", Name: siteConfig.name },
          To: [{ Email: message.to }],
          Subject: message.subject,
          Text: message.text,
          HTML: message.html,
        }),
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    }

    console.warn(`Correo no enviado (sin proveedor configurado): «${message.subject}»`);
    return false;
  } catch (error) {
    console.error("No se pudo enviar el correo", error);
    return false;
  }
}

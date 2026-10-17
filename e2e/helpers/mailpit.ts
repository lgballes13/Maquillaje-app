/**
 * Mailpit es el "buzón falso" de Supabase local: captura los correos que
 * enviaría la app. Lo usamos para leer el enlace de recuperación de contraseña.
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

interface MailpitSummary {
  ID: string;
}

export async function waitForEmailLink(to: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await res.json()) as { messages: MailpitSummary[] };
    const latest = messages[0];
    if (latest) {
      const message = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`)
      ).json()) as {
        HTML: string;
        Text: string;
      };
      const match = /href="([^"]+)"/.exec(message.HTML) ?? /(https?:\/\/\S+)/.exec(message.Text);
      if (match?.[1]) return match[1].replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No llegó ningún correo a ${to}`);
}

/** Espera un correo para `to` cuyo asunto contenga `subject`, y devuelve su texto. */
export async function waitForEmail(to: string, subject: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  const query = encodeURIComponent(`to:${to} subject:"${subject}"`);
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}`);
    const { messages } = (await res.json()) as { messages: MailpitSummary[] };
    const latest = messages[0];
    if (latest) {
      return (await (await fetch(`${MAILPIT_URL}/api/v1/message/${latest.ID}`)).json()) as {
        Subject: string;
        Text: string;
        HTML: string;
      };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No llegó el correo «${subject}» a ${to}`);
}

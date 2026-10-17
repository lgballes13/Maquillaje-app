# Publicar la app (paso a paso)

Esta guía lleva la app de tu computador a internet con tu dominio. Sigue el orden: cada paso usa
algo del anterior.

**Regla de oro:** las claves secretas se pegan **solo** en los paneles de Supabase, Vercel, Wompi,
Resend y GitHub. Nunca en el código, en un correo ni en el chat. Si una clave se filtra, créala de
nuevo en su panel y borra la vieja.

Necesitas cuentas en: [Supabase](https://supabase.com), [Vercel](https://vercel.com),
[Wompi](https://comercios.wompi.co), [Resend](https://resend.com) y, si quieres ver los errores,
[Sentry](https://sentry.io). También un dominio (por ejemplo, en GoDaddy, Namecheap o un
registrador `.co`).

> **Sobre los planes gratis:**
>
> - El plan gratis de Supabase pausa el proyecto tras 7 días sin uso y no hace respaldos (por eso
>   existe el respaldo diario de GitHub, ver [respaldos.md](respaldos.md)).
> - El plan gratis de Vercel (Hobby) es para uso personal, no comercial. Para un negocio, Vercel
>   pide el plan Pro. Revisa sus condiciones antes de lanzar.

## 1. Supabase de producción

1. En Supabase crea un proyecto nuevo. Región: **East US (North Virginia)** o **São Paulo**, las
   más cercanas a Colombia. Guarda la contraseña de la base de datos en tu gestor de contraseñas.
2. Aplica las migraciones y crea la primera admin con los pasos de «Supabase en producción» del
   [README](../README.md#supabase-en-producción). **No** cargues el `seed.sql`: es solo para
   pruebas.
3. En **Project Settings → API Keys** vas a necesitar la URL del proyecto, la clave `anon` y la
   `service_role`. No las copies a ningún lado todavía: las pegas directamente en Vercel en el
   paso 3.

## 2. Correos con Resend

1. En Resend agrega tu dominio y crea en tu registrador los registros DNS que te muestra. Espera
   a que diga **Verified**.
2. Crea una API key (permiso _Sending access_).
3. **Correos de la cuenta (confirmar registro, recuperar contraseña):** los envía Supabase, y su
   servidor gratis solo manda unos pocos por hora. Conéctalo a Resend: en Supabase ve a
   **Authentication → Emails → SMTP Settings**, activa _Custom SMTP_ y pon:
   - Host `smtp.resend.com`, puerto `465`, usuario `resend`.
   - Contraseña: la API key de Resend (pégala ahí, en el panel de Supabase).
   - Remitente: un correo de tu dominio, por ejemplo `cuentas@tudominio.com`.

## 3. Vercel

1. Entra a <https://vercel.com/new> e importa el repositorio `Maquillaje-app`. Vercel detecta
   Next.js solo; no cambies los comandos.
2. En **Settings → Environment Variables** agrega estas variables para _Production_:

   | Variable                        | Valor                                              |
   | ------------------------------- | -------------------------------------------------- |
   | `NEXT_PUBLIC_SITE_URL`          | `https://tudominio.com` (sin `/` al final)         |
   | `NEXT_PUBLIC_BUSINESS_NAME`     | El nombre del negocio                              |
   | `NEXT_PUBLIC_WHATSAPP_NUMBER`   | Solo dígitos, ej.: `573001234567`                  |
   | `NEXT_PUBLIC_CONTACT_EMAIL`     | Correo para quejas, reclamos y datos personales    |
   | `NEXT_PUBLIC_BUSINESS_LEGAL_ID` | NIT o cédula del responsable                       |
   | `NEXT_PUBLIC_BUSINESS_ADDRESS`  | Dirección del estudio                              |
   | `NEXT_PUBLIC_SUPABASE_URL`      | URL del proyecto de Supabase                       |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave `anon` de Supabase                           |
   | `SUPABASE_SERVICE_ROLE_KEY`     | **Secreta.** Clave `service_role` de Supabase      |
   | `NEXT_PUBLIC_WOMPI_PUBLIC_KEY`  | Paso 5 (al principio, la de pruebas `pub_test_…`)  |
   | `WOMPI_INTEGRITY_SECRET`        | **Secreta.** Paso 5                                |
   | `WOMPI_EVENTS_SECRET`           | **Secreta.** Paso 5                                |
   | `RESEND_API_KEY`                | **Secreta.** La API key de Resend                  |
   | `EMAIL_FROM`                    | Ej.: `Estudio <citas@tudominio.com>`               |
   | `CRON_SECRET`                   | **Secreta.** Genera una con `openssl rand -hex 32` |
   | `NEXT_PUBLIC_SENTRY_DSN`        | Opcional, paso 6                                   |

   No agregues `MAILPIT_URL`: es solo para tu computador.

3. Pulsa **Deploy**. Desde ahora, cada cambio que entre a `main` se publica solo.

> Las variables `NEXT_PUBLIC_*` se fijan al compilar. Si cambias una, ve a **Deployments → ⋯ →
> Redeploy**.

## 4. Dominio

1. En Vercel ve a **Settings → Domains** y agrega `tudominio.com` y `www.tudominio.com`.
2. Vercel te muestra los registros DNS (un `A` y un `CNAME`). Créalos en tu registrador. El
   certificado HTTPS se crea solo.
3. Vuelve a Supabase, **Authentication → URL Configuration**, y pon tu dominio en _Site URL_ y
   `https://tudominio.com/**` en _Redirect URLs_.
4. Revisa que `NEXT_PUBLIC_SITE_URL` en Vercel sea exactamente tu dominio y vuelve a desplegar.

## 5. Wompi

1. **Primero en pruebas.** En Wompi, modo **Pruebas → Desarrolladores → Llaves del API**, copia
   `pub_test_…`, `test_integrity_…` y `test_events_…` a las tres variables de Wompi en Vercel.
2. En **Desarrolladores → URL de eventos** pon `https://tudominio.com/api/webhooks/wompi`.
3. Vuelve a desplegar y haz una reserva y una compra con las tarjetas de prueba de
   <https://docs.wompi.co>. Revisa que la cita y el pedido queden pagados en el panel.
4. **Después, en real.** Cuando Wompi apruebe tu comercio, cambia al modo **Producción**, copia
   `pub_prod_…`, `prod_integrity_…` y `prod_events_…` a las mismas variables y configura la misma
   URL de eventos en ese modo. Vuelve a desplegar.
5. Haz un pago real pequeño y reembólsalo desde el panel de Wompi.

## 6. Sentry (opcional, recomendado)

1. En Sentry crea un proyecto de tipo **Next.js**.
2. Copia el **DSN** a `NEXT_PUBLIC_SENTRY_DSN` en Vercel.
3. Opcional: para ver el código exacto donde falló, agrega `SENTRY_ORG`, `SENTRY_PROJECT` y
   `SENTRY_AUTH_TOKEN` (**secreta**, la creas en Sentry → Settings → Auth Tokens).
4. Vuelve a desplegar.

## 7. Tareas diarias y respaldos

- **Recordatorios (Vercel Cron):** ya quedan programados por `vercel.json`. Revisa en **Vercel →
  Settings → Cron Jobs** que aparezca `/api/cron/recordatorios`.
- **Respaldo diario:** configúralo con [respaldos.md](respaldos.md) y haz una restauración de
  prueba.

## 8. Lista de revisión antes de lanzar

Marca cada punto antes de anunciar el sitio.

**Negocio y textos legales**

- [ ] Un abogado revisó la política de datos (`/privacidad`), los términos (`/terminos`), el texto
      de las preventas y el formato de autorización del portafolio.
- [ ] Las variables de contacto, NIT y dirección están llenas: en `/privacidad` y `/terminos` no
      aparece «[pendiente]».
- [ ] La tarifa de envío real está en `/admin/reglas` (hoy es un valor de ejemplo).
- [ ] Los servicios, precios, horarios y reglas de citas (anticipo, cancelación y saldo a favor)
      están revisados en el panel.

**Pruebas en el sitio publicado**

- [ ] Registro de una clienta nueva: llega el correo de confirmación.
- [ ] Recuperar contraseña: llega el correo.
- [ ] Una reserva y una compra pagadas con Wompi quedan como pagadas en el panel.
- [ ] Llega el correo de confirmación de la cita.
- [ ] La app se puede instalar desde el celular (Android e iPhone).
- [ ] Al compartir el enlace en WhatsApp sale la vista previa con el nombre del negocio.

**Seguridad y operación**

- [ ] La primera admin entra a `/admin` con verificación en dos pasos.
- [ ] Nadie más tiene el rol de admin.
- [ ] El respaldo diario corrió en verde y lo pudiste abrir y restaurar en un proyecto de prueba.
- [ ] La clave privada de los respaldos está guardada en dos lugares.
- [ ] Las claves de Wompi en Vercel son las de **producción**.
- [ ] Sentry recibe errores (opcional).

**Google**

- [ ] Agrega el sitio en [Google Search Console](https://search.google.com/search-console) y envía
      `https://tudominio.com/sitemap.xml`.
- [ ] Crea o actualiza el perfil del negocio en [Google Business](https://business.google.com)
      con el enlace al sitio.

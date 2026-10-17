# Estado del proyecto

> Este archivo se actualiza al terminar cada fase. Sirve para retomar el trabajo en
> una conversación nueva: léelo primero.

**Última actualización:** 2026-10-17
**Fase actual:** 6 · Portafolio (terminada, pendiente de tu revisión y merge del PR)

## Plan de fases

| Fase | Contenido                                                                                                | Estado       |
| ---- | -------------------------------------------------------------------------------------------------------- | ------------ |
| 0    | Base: Next.js, TypeScript, Tailwind/shadcn, lint, pruebas, CI, seguridad, Sentry, PWA                    | ✅ Terminada |
| 1    | Datos y acceso: migraciones Supabase, RLS, login, admin con 2FA, reglas configurables, auditoría, seed   | ✅ Terminada |
| 2    | Citas y pagos: servicios, disponibilidad, hold de 10 min, anti-solapamiento, política, anticipo, webhook | ✅ Terminada |
| 3    | Ciclo de la cita: asistió/no asistió, reprogramar, cancelar, penalidades, recordatorios                  | ✅ Terminada |
| 4    | Tienda: catálogo, búsqueda, carrito, checkout, stock atómico, pedidos                                    | ✅ Terminada |
| 5    | Preventa y lista de espera                                                                               | ✅ Terminada |
| 6    | Portafolio con autorización de fotos                                                                     | ✅ Terminada |
| 7    | Panel admin completo: agenda, gestión, reportes, CSV                                                     | ⏳ Pendiente |
| 8    | Legal (Ley 1581 y 1480), SEO, Lighthouse ≥ 90, respaldos, despliegue                                     | ⏳ Pendiente |

## Hecho en la Fase 0

- Proyecto Next.js 16 + TypeScript estricto + Tailwind CSS 4 + shadcn/ui (botón base).
- ESLint + Prettier; scripts `lint`, `typecheck`, `format`, `test`, `test:e2e`, `check`.
- Validación de variables de entorno con Zod (`src/lib/env.ts`) y plantilla `.env.example`.
- Seguridad: CSP con nonce por petición (`src/proxy.ts`), HSTS y demás encabezados.
- Sentry (servidor y navegador) sin datos personales; se activa con `NEXT_PUBLIC_SENTRY_DSN`.
- PWA: manifiesto, iconos 192/512/maskable y apple-icon (provisionales).
- Página de inicio provisional, 404 y página de error en español, botón flotante de WhatsApp.
- Endpoint `/api/health`.
- Pruebas: 16 unitarias (Vitest) y 12 E2E por navegador (Playwright) en Chromium escritorio,
  móvil 360 px y WebKit (iPhone): 34 pasan y 2 se omiten a propósito (teclado en móvil).
- CI en GitHub Actions + Dependabot. La CI pasa en verde en `main`.

## Hecho en la Fase 1

- Supabase local (Docker) con `supabase/config.toml`: contraseñas de 12+, 2FA TOTP activo,
  cambio de contraseña seguro.
- Migraciones (`supabase/migrations/`):
  - `profiles` (datos + versión y fecha de la autorización de datos) y `user_roles` (admin, artist).
  - `business_rules` versionadas e inmutables (valores provisionales) y `business_hours`.
  - `audit_log` inmutable llenado por triggers (reglas, horario, roles).
  - `consume_rate_limit` (límite de intentos, solo servidor).
  - RLS en todas las tablas; el admin necesita 2FA también en la base de datos.
- Seed con 3 usuarios de prueba (`supabase/seed.sql`).
- Páginas: `/registro`, `/ingresar`, `/recuperar`, `/restablecer`, `/cuenta`, `/privacidad`
  (borrador), `/auth/callback`, `/admin`, `/admin/seguridad` (activar 2FA),
  `/admin/verificar` (código 2FA), `/admin/reglas` (reglas, horario e historial).
- Pruebas: 69 unitarias, 35 de base de datos (pgTAP) y 19 E2E por navegador (Playwright).
- CI: nuevo trabajo que levanta Supabase, corre pgTAP y las E2E con base de datos real.

## Hecho en la Fase 2

- Pasarela elegida: **Wompi** (checkout web + webhook firmado). Ver DT-018.
- Migraciones:
  - `services` (nombre, duración, precio COP; se desactivan, no se borran) y `blocked_periods`.
  - `appointments` con «foto» del precio y de la política aceptada, y restricción que impide
    que dos citas se crucen (DT-019).
  - `payments` y `payment_events` (idempotencia de los avisos de la pasarela).
  - Funciones `create_booking`, `prepare_appointment_payment`, `apply_payment_event`
    (solo servidor) y `get_busy_periods` (sin datos personales).
- Páginas: `/agendar` (servicios), `/agendar/[servicio]` (día y hora), `/agendar/[servicio]/confirmar`
  (resumen, política y aceptación), `/citas/[id]` (estado y botón de pago), `/cuenta/citas`.
- Panel: `/admin/servicios` (crear y editar) y `/admin/citas` (próximas citas, pagos por revisar
  y bloqueos de agenda).
- Webhook `/api/webhooks/wompi`.
- Pruebas: 120 unitarias, 79 de base de datos (pgTAP) y 33 E2E por navegador (4 nuevas de citas y pagos).
- Servicios de ejemplo provisionales: social ($180.000, 90 min), novia ($450.000, 150 min),
  asesoría ($220.000, 120 min). Se editan desde el panel.

La Fase 2 se fusionó a `main` el 2026-10-17 (PR #9).

## Hecho en la Fase 3

- Migraciones: estados nuevos de la cita (asistió, no asistió, reprogramada), saldo a favor como
  libro de movimientos (`credit_movements`, DT-023) y funciones `cancel_appointment`,
  `reschedule_appointment`, `mark_attendance` y `my_credit_balance` (DT-024).
- El saldo a favor se aplica solo al anticipo de la siguiente reserva; si lo cubre, la cita se
  confirma sin pagar.
- Páginas: en «Tu cita» los botones Cambiar horario, Cancelar y Reprogramar (según el caso),
  `/citas/[id]/cancelar` (dice cuánto queda a favor antes de confirmar),
  `/citas/[id]/reprogramar` y su confirmación. «Mi cuenta» muestra el saldo a favor.
- Panel `/admin/citas`: sección «Por marcar asistencia» con Asistió / No asistió.
- Correos (DT-025): confirmación al quedar confirmada la cita y recordatorio el día anterior a
  las 9 a. m. (Vercel Cron, `/api/cron/recordatorios`). Resend en producción, Mailpit en local.
- Corregido: los días se veían como «16 De Oct»; ahora «16 de oct».
- Pruebas: 138 unitarias, 110 de base de datos (pgTAP) y 38 E2E por navegador (5 nuevas del
  ciclo de la cita).
- Ajuste posterior (aprobado 2026-10-17): el saldo a favor vence a los 15 días (regla
  configurable en el panel, DT-026). Se usa primero el que vence antes; «Mi cuenta» y la
  pantalla de cancelar muestran la fecha. Pruebas: 139 unitarias y 130 de base de datos.

## Hecho en la Fase 4

- Entrega decidida: recoger en el estudio (sin costo) o envío con tarifa fija configurable en el
  panel (hoy $15.000 provisional, DT-029).
- Migración `20261017000800_tienda.sql`: categorías, productos (precio con IVA, stock), fotos
  (bucket público `productos`), pedidos, productos del pedido y pagos del pedido. Funciones
  `create_order` (aparta las unidades bloqueando el stock), `prepare_order_payment`,
  `apply_order_payment_event` (solo servidor), `cancel_my_order`, `set_order_status` y
  `mark_order_reviewed` (DT-027, DT-028).
- Páginas: `/tienda` (búsqueda y categorías), `/tienda/[producto]`, `/carrito` (precios del
  servidor, entrega, total antes de pagar e información de retracto), `/pedidos/[id]` (pago con
  Wompi y cancelar), `/cuenta/pedidos`. El encabezado tiene «Tienda» y el carrito con contador.
- Panel: `/admin/productos` (crear y editar, categorías, fotos) y `/admin/pedidos` (filtros,
  listo / enviado / entregado / cancelar, pedidos por revisar). Tarifa de envío en
  `/admin/reglas`.
- Correo «Recibimos el pago de tu pedido».
- Productos de ejemplo en el seed: labial $45.000, base $89.000 y set de brochas $120.000.
- Pruebas: 178 unitarias, 177 de base de datos (pgTAP) y 43 E2E por navegador (5 nuevas de la
  tienda).

La Fase 4 se fusionó a `main` el 2026-10-17 (PR #12).

## Hecho en la Fase 5

- Decisiones: preventa con anticipo (DT-031), saldo a favor también en la tienda (DT-032) y
  lista de espera sin pago (DT-033).
- Migraciones `20261017000900_estados_de_preventa.sql` y `20261017001000_preventa.sql`: estados
  «reservado» y «llegó: paga el saldo», tipo de pedido, anticipo, saldo usado, plazo del saldo,
  `allow_preorder` en productos, `product_waitlist` y funciones `create_preorder`,
  `mark_preorder_arrived` y `expire_orders` (tarea diaria). `create_order` y
  `prepare_order_payment` ahora descuentan el saldo a favor.
- Páginas: el producto agotado muestra «Reservar» (con % de anticipo y días estimados) y
  «Avísame cuando llegue»; `/tienda/[producto]/reservar` (unidades, entrega, montos, condiciones
  de la preventa y aceptación); el pedido muestra anticipo, saldo y fecha límite, y cobra cada
  etapa. El carrito muestra el saldo a favor que se descuenta.
- Panel: filtro «Preventas» con «Marcar que llegó», opción «permitir reservarlo» en cada
  producto, conteo de preventas y lista de espera, y el plazo del saldo en `/admin/reglas`.
- Correos: «Reservaste…», «Llegó tu…: paga el saldo» y «Volvió…» (lista de espera).
- Pruebas: 190 unitarias, 226 de base de datos (pgTAP) y 48 E2E por navegador (5 nuevas).

La Fase 5 se fusionó a `main` el 2026-10-17 (PR #13).

## Hecho en la Fase 6

- Decisiones: portafolio solo con autorización firmada (DT-034) y fotos con comparación
  antes / después (DT-035).
- Migración `20261017001100_portafolio.sql`: categorías, autorizaciones (`portfolio_consents`),
  trabajos y fotos, con reglas en la base (publicar solo con autorización vigente y foto de
  «después»; al retirar la autorización se ocultan). Buckets `portafolio` (público) y
  `autorizaciones` (privado). Categorías de ejemplo en el seed: Novia, Social y Editorial.
- Páginas: `/portafolio` (filtro por categoría) y `/portafolio/[trabajo]` (antes / después,
  más fotos y «Agendar este estilo»). «Portafolio» en el menú principal.
- Panel `/admin/portafolio`: registrar la autorización con el formato firmado, verlo con enlace
  temporal, retirarla (oculta los trabajos y borra sus fotos), crear y editar trabajos, subir
  fotos de antes y después, publicar u ocultar, y categorías.
- Pruebas: 202 unitarias, 256 de base de datos (pgTAP) y 50 E2E por navegador (2 nuevas).

## Para activar pagos reales (cuando quieras)

1. Crea tu cuenta en <https://comercios.wompi.co> y entra en modo **Pruebas**.
2. En **Desarrolladores → Llaves del API** copia la llave pública (`pub_test_…`), el secreto de
   integridad (`test_integrity_…`) y el de eventos (`test_events_…`) a `.env.local` o a Vercel.
   **Nunca los pegues en el chat.**
3. En **Desarrolladores → URL de eventos** pon `https://TU-DOMINIO/api/webhooks/wompi`.
4. Cuando todo funcione en pruebas, repite con las llaves de producción (`pub_prod_…`).

## Preguntas abiertas

- **Plazo para reprogramar:** confirmado: horas que tiene la clienta, después de no asistir,
  para reprogramar con el descuento del porcentaje.
- **Lista de clientes en el panel:** queda para la Fase 7.

## Datos del negocio pendientes

- [ ] Nombre del negocio, ciudad y país (¿Colombia, COP, America/Bogota?)
- [x] Pasarela de pago: Wompi
- [ ] Valores iniciales de la política de anticipo (%, horas para reprogramar, % de pérdida, horas para cancelar gratis)
- [x] Canales de notificación: correo con Resend (WhatsApp automático queda fuera por ahora)
- [x] Opciones de envío: recoger en el estudio o envío con tarifa fija
- [ ] Tarifa de envío real (hoy $15.000 provisional) y dirección del estudio para recoger
- [ ] Productos reales: nombres, precios con IVA, fotos y unidades
- [ ] Preventa: % de anticipo (hoy 50 %), días estimados de entrega (hoy 15) y plazo para pagar el saldo (hoy 7 días), todos provisionales y editables en el panel
- [ ] Número de WhatsApp
- [ ] ¿Una sola maquilladora al inicio? (la Fase 2 asume que sí: una sola agenda)
- [ ] Colores y logo de la marca (los actuales son provisionales)

## Cuentas que necesitarás

- [x] GitHub (repositorio `lgballes13/Maquillaje-app`)
- [x] Supabase (proyecto creado; falta aplicar migraciones con `npx supabase db push`)
- [ ] Vercel (cuando quieras ver la app publicada)
- [ ] Sentry (opcional, cuando se publique)
- [ ] Wompi en modo pruebas (pasos arriba; la app ya está lista)
- [ ] Resend (para enviar correos reales; pasos en el README)

## Riesgos y pendientes conocidos

- `npm audit` reporta vulnerabilidades altas solo en herramientas de desarrollo
  (`eslint-config-next` → `braces`); no llegan a producción. Las dependencias de producción
  tienen 0 vulnerabilidades. Dependabot propondrá la actualización cuando exista.
- Las acciones de GitHub (`checkout`, `setup-node`, `upload-artifact`) están en v4, que usa
  Node 20 (obsoleto en GitHub). Dependabot propondrá la actualización.
- La revisión de contraseñas filtradas (HaveIBeenPwned) es paga en Supabase; pendiente.
- Producción: hay que configurar a mano en el panel de Supabase la Site URL, redirect URLs,
  largo mínimo de contraseña y crear la primera admin (pasos en el README).
- Lighthouse aún no se ha medido; se mide y ajusta en la Fase 8.
- La CSP con nonce obliga a renderizar todo por petición (ver DT-004); revisar rendimiento en la Fase 8.
- Pagos: el flujo con Wompi se probó con avisos simulados y firmados; falta probarlo contra el
  sandbox real de Wompi cuando tengas las llaves de pruebas.
- Una cita marcada «por revisar» (pago tardío con el horario ocupado, monto que no coincide)
  se resuelve a mano por ahora; las devoluciones automáticas no están en el alcance.
- El recordatorio sale el día anterior a las 9 a. m., no exactamente 24 horas antes (límite del
  plan gratuito de Vercel, DT-025).
- Si la admin no marca la asistencia, la cita queda «confirmada» y la clienta no ve la opción de
  reprogramar; el plazo corre igual desde la hora de la cita.
- Al reprogramar se usa el precio y el % de anticipo vigentes (DT-024): si cambiaron, la clienta
  paga la diferencia o le sobra saldo.
- El saldo a favor vence a los 15 días y no se devuelve en dinero desde la app.
- Tienda: el texto de retracto y garantía del carrito es un borrador. Falta revisión legal,
  sobre todo las excepciones del retracto para productos de uso personal (Ley 1480, art. 47).
- Tienda: las devoluciones de dinero (pedido pagado y cancelado, pago tardío sin stock) se hacen
  a mano en Wompi; el pedido queda «por revisar» en el panel.
- Tienda: no hay correo cuando el pedido está listo o enviado; la clienta lo ve en «Mis pedidos».
- Portafolio: falta el texto del formato de autorización que firmará la clienta (revisión legal,
  Ley 1581). La app guarda el formato firmado, pero no genera el documento.
- Portafolio: las fotos se suben tal cual; si la clienta no quiere salir reconocible, hay que
  editar la foto antes de subirla.
- Preventa: el texto de condiciones de la preventa es un borrador (revisión legal junto con el de
  la tienda). La clienta no puede cancelar sola una reserva ya pagada: escribe y la admin la
  cancela; el anticipo se devuelve a mano en Wompi.
- Preventa: el tiempo de llegada es un estimado; la app no avisa si se pasa de esos días.
- Lista de espera: el aviso sale cuando la admin guarda el producto con unidades desde el panel
  (no si el stock cambia por otro camino, como una cancelación).
- Las citas vencidas se marcan cuando alguien hace una reserva nueva; mientras tanto se ven como
  vencidas en pantalla. No hace falta un proceso programado.

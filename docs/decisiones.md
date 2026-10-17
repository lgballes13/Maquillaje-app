# Registro de decisiones técnicas

Cada decisión tiene un número (DT-XXX), la fecha, qué se decidió y por qué.
Si una decisión cambia, no se borra: se marca como reemplazada y se agrega una nueva.

---

## DT-001 · Next.js 16 con App Router y TypeScript estricto

**Fecha:** 2026-10-16 · **Estado:** vigente

- Versión estable más reciente al iniciar el proyecto.
- Además de `strict`, se activan `noUncheckedIndexedAccess` (obliga a revisar que un
  elemento de una lista exista antes de usarlo) y `noImplicitOverride`.
- ESLint prohíbe `any` para que el tipado no se pueda saltar.

## DT-002 · Componentes shadcn/ui escritos en el repositorio

**Fecha:** 2026-10-16 · **Estado:** vigente

- shadcn/ui no es una librería que se instala: copia el código del componente al
  proyecto. Así podemos ajustarlos (por ejemplo, todos los botones miden ≥ 44 px).
- `components.json` queda configurado: en tu computador puedes agregar más con
  `npx shadcn@latest add <componente>`.
- Usa los primitivos accesibles de Radix (`radix-ui`) e iconos `lucide-react`.

## DT-003 · Validación de variables de entorno con Zod

**Fecha:** 2026-10-16 · **Estado:** vigente

- `src/lib/env.ts` valida las variables al arrancar. Si falta o está mal una
  variable, la app falla de inmediato con un mensaje claro en español, en lugar de
  fallar después de forma confusa.
- Las variables públicas (`NEXT_PUBLIC_*`) y las secretas se validan por separado,
  para que un secreto nunca termine en el navegador.

## DT-004 · CSP estricta con nonce (sin `unsafe-inline`)

**Fecha:** 2026-10-16 · **Estado:** vigente

- La CSP se genera en `src/proxy.ts` con un valor aleatorio (nonce) por petición. Solo
  se ejecutan los scripts que llevan ese nonce, lo que bloquea casi todo ataque XSS.
- **Costo:** todas las páginas se generan en cada petición (no hay páginas estáticas
  ni `cacheComponents`). Se acepta porque casi todo el sitio muestra datos en vivo
  (disponibilidad, stock, precios) y maneja datos personales y pagos.
- **Consecuencia práctica:** no se pueden usar estilos en línea (`style={{...}}`);
  todo va con clases de Tailwind. Una prueba E2E falla si la CSP bloquea algo.
- `upgrade-insecure-requests` solo se envía si `NEXT_PUBLIC_SITE_URL` empieza por `https://`:
  en `http://localhost` Safari intentaba cargar todo por HTTPS y la página quedaba sin estilos.
- Alternativa descartada: CSP con `'unsafe-inline'` (más rápida, pero mucho más débil).
- Si en la Fase 8 Lighthouse no llega a 90 en rendimiento, se revisa esta decisión.

## DT-005 · Encabezados de seguridad fijos en `next.config.ts`

**Fecha:** 2026-10-16 · **Estado:** vigente

- HSTS (2 años), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy` y `Cross-Origin-Opener-Policy`.
- Se oculta el encabezado `X-Powered-By`.
- Están en `src/lib/security/headers.ts` y una prueba E2E verifica que lleguen.

## DT-006 · Sentry con túnel propio y sin datos personales

**Fecha:** 2026-10-16 · **Estado:** vigente

- Los errores del navegador se envían a `/monitoring` (nuestro dominio), y desde ahí
  a Sentry. Así no hay que abrir la CSP a otro dominio.
- Se desactiva el envío de usuario, cookies, encabezados, cuerpos y parámetros de URL
  (Ley 1581: minimizar datos personales enviados a terceros).
- Sentry solo se activa si existe `NEXT_PUBLIC_SENTRY_DSN`.

## DT-007 · PWA instalable sin service worker (por ahora)

**Fecha:** 2026-10-16 · **Estado:** vigente

- El manifiesto (`src/app/manifest.ts`) y los iconos bastan para instalar la app en
  Android y iOS.
- El modo sin conexión y las notificaciones push se evaluarán más adelante, porque un
  service worker mal configurado puede mostrar precios o disponibilidad desactualizados.

## DT-008 · Pruebas E2E contra la versión de producción

**Fecha:** 2026-10-16 · **Estado:** vigente

- Playwright compila y levanta `npm run start` (no `npm run dev`), para probar lo mismo
  que verá el cliente, incluida la CSP de producción.
- Proyectos: `escritorio-chromium`, `movil-360` (360 × 740 px) e `iphone-webkit` (motor de Safari).
- Se usa `@axe-core/playwright` para detectar problemas de accesibilidad WCAG 2.1 AA.

## DT-009 · Reglas del negocio versionadas e inmutables

**Fecha:** 2026-10-17 · **Estado:** vigente

- Cambiar una regla (anticipo, plazos, penalidades) crea una **versión nueva** en
  `business_rules`; las versiones nunca se editan ni se borran (la base de datos lo impide).
- Motivo: cada cita guardará la versión de la política que aceptó la clienta. Si la regla
  cambia después, se sigue aplicando la que ella aceptó.
- Los límites de cada valor están dos veces: en Zod (mensaje claro en el formulario) y en
  la base de datos (`CHECK`), por si alguien salta la app.

## DT-010 · El rol admin exige 2FA también dentro de la base de datos

**Fecha:** 2026-10-17 · **Estado:** vigente

- `public.is_admin()` es verdadero solo si la persona tiene el rol **y** su sesión se
  verificó con segundo factor (`aal = aal2` en el token).
- Aunque alguien robe la contraseña de la admin, las reglas RLS no le dejan leer ni cambiar
  nada de administración sin el código del autenticador.
- La app además redirige: sin 2FA configurado → `/admin/seguridad`; configurado pero no usado
  en la sesión → `/admin/verificar`. A quien no es admin se le muestra un 404.
- Se eligió TOTP (app autenticadora) porque es gratis en Supabase y no depende de SMS.

## DT-011 · Autorización de datos (Ley 1581) validada en la base de datos

**Fecha:** 2026-10-17 · **Estado:** vigente

- El trigger que crea el perfil rechaza el registro si no viene la autorización y la versión
  de la política. Así no se puede saltar llamando a Supabase directamente.
- La fecha de aceptación la pone el servidor (`now()`), no el navegador.
- La versión vigente está en `src/config/legal.ts`.

## DT-012 · Límite de intentos en Postgres, solo accesible para el servidor

**Fecha:** 2026-10-17 · **Estado:** vigente

- Función `consume_rate_limit` (ventana fija) que solo puede ejecutar `service_role`. Si los
  visitantes pudieran llamarla, podrían bloquear a otra persona a propósito.
- Límites: login 5 intentos por correo y 20 por IP cada 15 min; registro 5 por IP por hora;
  recuperación 3 por correo y 10 por IP por hora; código 2FA 5 cada 5 min.
- Las llaves se guardan como hash SHA-256 (no se almacenan correos ni IP en claro).
- Si la base de datos falla, se bloquea el intento (falla cerrado).
- Se suma a los límites propios de Supabase Auth, que protegen si alguien llama a la API de
  Supabase directamente.
- La IP se lee de `x-forwarded-for`. En Vercel la pone la plataforma y no se puede falsear;
  **si algún día se aloja en otro proveedor, hay que revisarlo.**
- Alternativa descartada por ahora: Redis (Upstash). Es otro servicio y otra cuenta; Postgres
  alcanza para el volumen de un negocio local.

## DT-013 · Sesión validada con `getClaims()` y renovada en el proxy

**Fecha:** 2026-10-17 · **Estado:** vigente

- En el servidor nunca se confía en `getSession()` (solo lee la cookie). Se usa `getClaims()`,
  que verifica la firma del token.
- `src/proxy.ts` renueva el token en cada petición y conserva la CSP con nonce.
- El navegador nunca habla directo con Supabase: todo pasa por Server Actions. Por eso la CSP
  no necesita abrir `connect-src` a Supabase para el login.

## DT-014 · Mensajes que no revelan si un correo está registrado

**Fecha:** 2026-10-17 · **Estado:** vigente

- Login: siempre «Correo o contraseña incorrectos».
- Recuperar contraseña: siempre «Si el correo está registrado, te enviamos un enlace».
- Registro con un correo existente: mismo mensaje que un registro nuevo.

## DT-015 · Contraseñas de mínimo 12 caracteres, sin reglas de composición

**Fecha:** 2026-10-17 · **Estado:** vigente

- OWASP ASVS recomienda largo (≥ 12) en lugar de exigir mayúsculas o símbolos.
- Máximo 128 caracteres. Se sugiere usar una frase.
- La revisión contra contraseñas filtradas (HaveIBeenPwned) es una opción paga de Supabase;
  queda como mejora futura.

## DT-016 · Supabase local en Docker para desarrollo y CI

**Fecha:** 2026-10-17 · **Estado:** vigente

- Las migraciones, el seed y las pruebas corren contra un Supabase local igual al de
  producción. La CI levanta el suyo en cada ejecución.
- Realtime queda desactivado en `supabase/config.toml` porque todavía no se usa.
- Las pruebas E2E crean sus propios usuarios con la llave service_role **local** (el helper se
  niega a correr contra una URL que no sea localhost) y simulan una IP distinta por prueba.

## DT-017 · Los formularios conservan lo escrito después de un error

**Fecha:** 2026-10-17 · **Estado:** vigente

- React 19 limpia los formularios después de cada envío. Las Server Actions devuelven los
  valores enviados (nunca contraseñas ni códigos 2FA) para volver a mostrarlos.
- Lo detectaron las pruebas E2E: tras un error, el formulario de reglas volvía a los valores
  anteriores.

## DT-018 · Wompi como pasarela de pagos (checkout web + webhook)

**Fecha:** 2026-10-17 · **Estado:** vigente (elegida por la dueña del proyecto)

- Wompi es colombiana y acepta tarjeta, PSE, Nequi y otros medios en COP.
- Se usa el **checkout web** (formulario que lleva a `checkout.wompi.co`): la app nunca ve
  datos de tarjeta, lo que reduce el alcance de PCI.
- El monto va firmado con el **secreto de integridad**; si alguien lo cambia en el navegador,
  Wompi rechaza la transacción.
- El resultado llega por **webhook** a `/api/webhooks/wompi`; se verifica con el **secreto de
  eventos** (comparación en tiempo constante) antes de aplicar nada.
- Respaldo: al volver de Wompi (`?id=`), el servidor consulta la transacción en la API de
  Wompi y la aplica si pertenece a esa cita. Sirve cuando el webhook se demora.
- La lógica de pagos está separada (`src/modules/payments/`) para poder cambiar de pasarela.

## DT-019 · La base de datos garantiza que dos citas nunca se crucen

**Fecha:** 2026-10-17 · **Estado:** vigente

- Restricción `EXCLUDE USING gist (period WITH &&)` sobre citas pendientes de pago o
  confirmadas. `period` = inicio de la cita hasta su fin + minutos de preparación.
- Funciona aunque dos personas reserven en el mismo milisegundo; no depende del código de la app.
- Por ahora hay **una sola agenda** (una maquilladora). Si se agregan más, la restricción
  incluirá la maquilladora (`artist_id WITH =`).

## DT-020 · Reserva en dos pasos: hold de minutos y luego pago

**Fecha:** 2026-10-17 · **Estado:** vigente

- `create_booking()` aparta el horario por `booking_hold_minutes` (hoy 10) en estado
  «pendiente de pago». Si no se paga a tiempo, cualquier reserva nueva lo libera.
- Una clienta tiene un solo horario apartado a la vez.
- Si llega un pago **pendiente** (ej.: PSE), el horario se mantiene 60 minutos más.
- Si llega un pago aprobado **después** de vencer el tiempo: si el horario sigue libre se
  confirma; si ya lo tomó otra persona, la cita queda «por revisar» en el panel para devolver
  el dinero o reprogramar. Nunca se pierde un pago en silencio.

## DT-021 · El dinero se calcula en la base de datos

**Fecha:** 2026-10-17 · **Estado:** vigente

- El navegador solo envía servicio, hora y versión de la política aceptada.
- `create_booking()` toma precio, duración y % de anticipo de la base y guarda una «foto» en
  la cita (precio, anticipo, versión de reglas), redondeando el anticipo hacia arriba al peso.
- Si las reglas cambian mientras la clienta reserva, la reserva se rechaza y debe aceptar la
  versión nueva.
- `apply_payment_event()` (solo service_role) es idempotente: cada estado de cada transacción
  se aplica una sola vez, un pago aprobado nunca retrocede, y un monto que no coincide con el
  anticipo no confirma nada.

## DT-022 · Horarios cada 30 minutos en la zona horaria del negocio

**Fecha:** 2026-10-17 · **Estado:** vigente

- Los horarios ofrecidos se calculan en el servidor (`computeSlots`) en hora de Bogotá, cada
  30 minutos desde la apertura, y deben terminar antes del cierre.
- Bloqueos de agenda (`blocked_periods`) para vacaciones o eventos; el motivo solo lo ve el admin.
- La disponibilidad pública (`get_busy_periods`) solo expone inicio y fin, sin datos de nadie.

## DT-023 · Saldo a favor como libro de movimientos

**Fecha:** 2026-10-17 · **Estado:** vigente

- Cada peso que entra o sale del saldo a favor es una fila en `credit_movements` (motivo, cita,
  monto con signo). El saldo es la suma; nunca se guarda un total que se pueda editar.
- Solo las funciones de la base de datos escriben movimientos; la clienta solo puede leer los
  suyos (RLS) y la admin todos.
- Las operaciones de una misma clienta se hacen en fila (`pg_advisory_xact_lock`), así dos
  reservas simultáneas no pueden gastar el mismo saldo dos veces.
- Al reservar, el saldo se aplica solo hasta el valor del anticipo. Si lo cubre, la cita queda
  confirmada sin pasar por la pasarela. Si una reserva sin pagar vence o se libera, el saldo
  aplicado vuelve.
- El saldo no se devuelve en dinero desde la app; las devoluciones se hacen a mano.

## DT-024 · Cancelar, cambiar de horario y no asistir

**Fecha:** 2026-10-17 · **Estado:** vigente

- Siempre se aplica la política que la clienta **aceptó al reservar** (`rules_version` de la
  cita), no la vigente.
- Cancelar con `free_cancellation_hours` o más de anticipación: todo el anticipo queda a favor.
  Con menos: se descuenta `reschedule_penalty_percent` y el resto queda a favor (decisión de la
  dueña del negocio, 2026-10-17).
- Cambiar de horario solo con `free_cancellation_hours` o más de anticipación, sin costo. Con
  menos horas solo se puede cancelar.
- No asistió (lo marca la admin): la clienta tiene `reschedule_window_hours` desde la hora de la
  cita para reprogramar; se descuenta el mismo porcentaje y el resto se abona a la nueva cita.
  Después del plazo pierde el anticipo.
- Reprogramar crea una **cita nueva** enlazada a la anterior (`rescheduled_from`) con el precio y
  la política vigentes, que la clienta acepta otra vez. El anticipo anterior entra como saldo a
  favor y se aplica a la nueva. Si el anticipo vigente es mayor, paga la diferencia; si es menor,
  le sobra saldo. Cada cita se reprograma una sola vez.
- El cambio es atómico: si el horario nuevo ya no está libre, la cita original queda igual.

## DT-025 · Correos de citas y recordatorio diario

**Fecha:** 2026-10-17 · **Estado:** vigente

- Resend en producción; Mailpit (buzón de Supabase local) en desarrollo y CI.
- Cada correo se «reserva» primero en la cita (`confirmation_sent_at`, `reminder_sent_at`) con
  una actualización condicional, así no se envía dos veces aunque el webhook llegue repetido.
- Un correo que falla nunca rompe el pago ni la reserva.
- El recordatorio se envía **el día anterior a las 9 a. m.** (Colombia), no exactamente 24 horas
  antes: el plan gratuito de Vercel solo permite tareas programadas una vez al día. Con el plan
  Pro se puede pasar a cada hora sin cambiar el código de la app.
- La ruta `/api/cron/recordatorios` exige `CRON_SECRET` (comparación de tiempo constante).

## DT-026 · El saldo a favor vence

**Fecha:** 2026-10-17 · **Estado:** vigente (decisión de la dueña del negocio: 15 días)

- Cada abono de saldo a favor es un «lote» que vence `credit_validity_days` días después de
  generarse (hoy 15). El valor es una regla más del panel y se toma de la política que la
  clienta aceptó en la cita que generó el saldo.
- Al reservar se usa primero el saldo que vence antes.
- Si una reserva sin pagar se libera, el saldo vuelve a su mismo lote y conserva la fecha de
  vencimiento original (no se renueva).
- El saldo vencido deja de contar en el mismo momento en que vence. La tarea diaria (y cada
  reserva de la clienta) escribe además el movimiento «Vencido», para que el historial cuadre.
- Caso raro: si un pago tardío necesita saldo que ya se usó o venció, queda una «deuda» negativa
  y la cita se marca «por revisar».

## DT-027 · Stock de la tienda: apartar al ir a pagar, descontar al aprobar

**Fecha:** 2026-10-17 · **Estado:** vigente

- `products.stock` son las unidades físicas en el estudio. Disponible = stock − unidades de
  pedidos sin pagar que todavía están a tiempo (`get_product_availability`).
- `create_order` bloquea las filas de los productos (`FOR UPDATE`, siempre en el mismo orden para
  no trabarse) y revisa el disponible antes de apartar: dos clientas nunca se llevan la misma
  última unidad.
- El tiempo para pagar es el mismo de las citas (`booking_hold_minutes`, hoy 10 minutos). Si no
  paga, el pedido vence y las unidades se liberan solas.
- Al aprobarse el pago se descuentan las unidades del stock. Una clienta tiene un solo pedido sin
  pagar: si hace otro, el anterior se cancela.
- El carrito vive en el navegador (localStorage) y solo guarda productos y cantidades; precios,
  stock, envío y total los calcula siempre el servidor.

## DT-028 · Pagos de pedidos con la misma pasarela que las citas

**Fecha:** 2026-10-17 · **Estado:** vigente

- Mismo flujo firmado de Wompi (DT-018). Las referencias de pedidos empiezan por `PED-` y las de
  citas por `CITA-`; el webhook envía cada una a su función (`apply_order_payment_event` o
  `apply_payment_event`). La idempotencia (`payment_events`) es compartida.
- Pago aprobado a tiempo → pedido «pagado» y correo de confirmación (una sola vez).
- Pago aprobado tarde: si todavía hay unidades, se descuentan y el pedido queda pagado; si no
  alcanzan, el pedido queda «por revisar» para devolver el dinero a mano.
- La admin avanza el pedido: pagado → listo para recoger / enviado → entregado. Si cancela un
  pedido pagado, las unidades vuelven al stock y el pedido queda «por revisar» (la devolución se
  hace en el panel de Wompi; las devoluciones automáticas no están en el alcance).

## DT-029 · Entrega: recoger en el estudio o envío con tarifa fija

**Fecha:** 2026-10-17 · **Estado:** vigente (decisión de la dueña: «Recoger y envío»)

- La tarifa de envío es una regla más del panel (`shipping_fee_cop`, hoy $15.000 provisional;
  0 = envío gratis). Cambiarla crea una versión nueva de las reglas: un pedido hecho con la
  tarifa vieja se rechaza con «las condiciones cambiaron» para que la clienta vea el total real.
- El total con envío se muestra antes de pagar (Ley 1480). No hay tarifas por ciudad ni
  integración con transportadoras.

## DT-030 · Fotos de productos

**Fecha:** 2026-10-17 · **Estado:** vigente

- Bucket público `productos` de Supabase Storage (cualquiera ve las fotos; solo la admin con 2FA
  las sube o borra, por reglas de la base). Límite de 5 MB; JPG, PNG o WebP.
- La subida pasa por una server action: se revisa el tipo real del archivo por sus primeros
  bytes (no por el nombre), el tamaño y un límite de intentos; el nombre del archivo lo pone el
  servidor. Máximo 8 fotos por producto, cada una con su descripción para lectores de pantalla.
- `next/image` optimiza las fotos en producción (https). En local Supabase usa
  `http://127.0.0.1`, que el optimizador bloquea por seguridad, así que ahí se muestran sin
  optimizar (`src/modules/shop/images.ts`).

## DT-031 · Preventa: reservar un producto agotado con anticipo

**Fecha:** 2026-10-17 · **Estado:** vigente (plan aprobado por la dueña)

- Un producto agotado muestra «Reservar» en vez de «Agregar al carrito» si tiene activada la
  opción «permitir reservarlo» (`products.allow_preorder`, activa por defecto). Se informa el
  % de anticipo (`preorder_deposit_percent`) y los días estimados (`preorder_delivery_days`).
- La preventa es un pedido más (`orders.kind = 'preorder'`) con un solo producto. El anticipo se
  calcula sobre los productos (redondeado hacia arriba al peso); el envío va en el saldo.
- Estados: pendiente de pago → `deposit_paid` (reservado) → la admin marca «Llegó» →
  `awaiting_balance` (aparta las unidades y avisa por correo) → la clienta paga el saldo →
  `paid` y sigue como un pedido normal. Si el anticipo cubre todo, «Llegó» lo deja pagado.
- Plazo para pagar el saldo: `preorder_balance_days` (7 días, configurable en el panel). Si no
  paga a tiempo, se cancela, las unidades se liberan y **todo el anticipo pasa a saldo a favor**
  (vence en `credit_validity_days`, como el de las citas). Decisión de la dueña: opción 1.
- Lo cierra la tarea diaria (`expire_orders`) o, antes, la propia página del pedido o un pedido
  nuevo. Una preventa cancelada por la admin queda «por revisar» para devolver el anticipo en
  Wompi.

## DT-032 · El saldo a favor también se usa en la tienda

**Fecha:** 2026-10-17 · **Estado:** vigente (amplía DT-024)

- Al crear un pedido, la base descuenta automáticamente el saldo vigente (el que vence primero):
  del total en una compra y del anticipo en una preventa. Wompi cobra solo la diferencia; si el
  saldo cubre todo, el pedido queda pagado (o reservado) sin pasar por Wompi.
- Si el pedido vence o se cancela antes de pagarse, el saldo usado vuelve. El saldo del pago del
  saldo de una preventa no se descuenta: ese pago va completo por Wompi.
- Movimientos nuevos: `applied_to_order` y `preorder_unpaid` (ligados a `order_id`).

## DT-033 · Lista de espera sin pago

**Fecha:** 2026-10-17 · **Estado:** vigente

- «Avísame cuando llegue» en un producto agotado (requiere cuenta; no aparta nada ni cobra).
  Tabla `product_waitlist` con RLS: cada clienta ve, crea y borra solo lo suyo.
- Cuando la admin guarda un producto con unidades disponibles, la app avisa por correo a cada
  inscrita una sola vez (`notified_at`). Para un nuevo aviso, la clienta se vuelve a inscribir.
- El panel de productos muestra cuántas preventas y personas en lista de espera tiene cada uno.

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

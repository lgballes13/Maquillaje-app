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

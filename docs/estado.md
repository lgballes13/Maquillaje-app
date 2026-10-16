# Estado del proyecto

> Este archivo se actualiza al terminar cada fase. Sirve para retomar el trabajo en
> una conversación nueva: léelo primero.

**Última actualización:** 2026-10-16
**Fase actual:** 0 · Base del proyecto (terminada, pendiente de tu revisión)

## Plan de fases

| Fase | Contenido                                                                                                | Estado       |
| ---- | -------------------------------------------------------------------------------------------------------- | ------------ |
| 0    | Base: Next.js, TypeScript, Tailwind/shadcn, lint, pruebas, CI, seguridad, Sentry, PWA                    | ✅ Terminada |
| 1    | Datos y acceso: migraciones Supabase, RLS, login, admin con 2FA, reglas configurables, auditoría, seed   | ⏳ Pendiente |
| 2    | Citas y pagos: servicios, disponibilidad, hold de 10 min, anti-solapamiento, política, anticipo, webhook | ⏳ Pendiente |
| 3    | Ciclo de la cita: asistió/no asistió, reprogramar, cancelar, penalidades, recordatorios                  | ⏳ Pendiente |
| 4    | Tienda: catálogo, búsqueda, carrito, checkout, stock atómico, pedidos                                    | ⏳ Pendiente |
| 5    | Preventa y lista de espera                                                                               | ⏳ Pendiente |
| 6    | Portafolio con autorización de fotos                                                                     | ⏳ Pendiente |
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

## Datos del negocio pendientes (los necesito antes de la Fase 1 o 2)

- [ ] Nombre del negocio, ciudad y país (¿Colombia, COP, America/Bogota?)
- [ ] Pasarela de pago (propuesta: Wompi)
- [ ] Valores iniciales de la política de anticipo (%, horas para reprogramar, % de pérdida, horas para cancelar gratis)
- [ ] Canales de notificación (propuesta: correo con Resend)
- [ ] Opciones de envío
- [ ] Preventa: % de anticipo y días estimados de entrega
- [ ] Número de WhatsApp
- [ ] ¿Una sola maquilladora al inicio?
- [ ] Colores y logo de la marca (los actuales son provisionales)

## Cuentas que necesitarás

- [x] GitHub (repositorio `lgballes13/Maquillaje-app`)
- [ ] Supabase (Fase 1)
- [ ] Vercel (cuando quieras ver la app publicada)
- [ ] Sentry (opcional, cuando se publique)
- [ ] Pasarela de pago en modo pruebas (Fase 2)
- [ ] Resend (Fase 3)

## Riesgos y pendientes conocidos

- `npm audit` reporta vulnerabilidades altas solo en herramientas de desarrollo
  (`eslint-config-next` → `braces`); no llegan a producción. Las dependencias de producción
  tienen 0 vulnerabilidades. Dependabot propondrá la actualización cuando exista.
- Las acciones de GitHub (`checkout`, `setup-node`, `upload-artifact`) están en v4, que usa
  Node 20 (obsoleto en GitHub). Dependabot propondrá la actualización.
- Lighthouse aún no se ha medido; se mide y ajusta en la Fase 8.
- La CSP con nonce obliga a renderizar todo por petición (ver DT-004); revisar rendimiento en la Fase 8.

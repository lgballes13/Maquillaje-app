# Maquillaje App

Aplicación web _mobile-first_ e instalable (PWA) para un negocio de maquillaje:
agendamiento de citas con anticipo, tienda en línea, preventas, portafolio y
panel de administración.

> Estado actual y próximos pasos: [`docs/estado.md`](docs/estado.md).
> Por qué se tomó cada decisión técnica: [`docs/decisiones.md`](docs/decisiones.md).

## Tecnologías

| Pieza                           | Herramienta                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| Frontend y backend              | Next.js 16 (App Router) + TypeScript estricto                |
| Estilos                         | Tailwind CSS 4 + componentes shadcn/ui                       |
| Base de datos, login y archivos | Supabase (PostgreSQL + Auth + Storage) con RLS               |
| Validación                      | Zod                                                          |
| Pruebas                         | Vitest (unitarias), pgTAP (base de datos) y Playwright (E2E) |
| Errores                         | Sentry                                                       |
| Hosting                         | Vercel                                                       |

## Requisitos

- **Node.js 22** o superior → <https://nodejs.org> (verifica con `node -v`).
- **Git** → <https://git-scm.com>.
- **Docker Desktop** → <https://www.docker.com/products/docker-desktop/> (para la base de
  datos local de Supabase). Ábrelo antes de ejecutar `npm run db:start`.

## Instalación (primera vez)

```bash
git clone https://github.com/lgballes13/Maquillaje-app.git
cd Maquillaje-app
npm install
cp .env.example .env.local      # en Windows (PowerShell): copy .env.example .env.local
npx playwright install          # descarga los navegadores para las pruebas E2E
npm run db:start                # inicia Supabase local en Docker (la primera vez tarda varios minutos)
```

`npm run db:start` muestra al final varios datos. Copia estos tres a `.env.local`:

| Lo que muestra Supabase         | Variable en `.env.local`        |
| ------------------------------- | ------------------------------- |
| `API URL` (o `Project URL`)     | `NEXT_PUBLIC_SUPABASE_URL`      |
| `anon key` (o `Publishable`)    | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role key` (o `Secret`) | `SUPABASE_SERVICE_ROLE_KEY`     |

Si los necesitas de nuevo: `npx supabase status`.

Luego ejecuta `npm run dev` y abre <http://localhost:3000>.

### Usuarios de prueba (solo en local)

`supabase/seed.sql` crea estos usuarios cada vez que ejecutas `npm run db:reset`
(contraseña de todos: `ClaveDePrueba123`):

| Correo                  | Rol                                             |
| ----------------------- | ----------------------------------------------- |
| `admin@demo.example`    | Admin (te pedirá configurar 2FA la primera vez) |
| `cliente@demo.example`  | Cliente                                         |
| `cliente2@demo.example` | Cliente                                         |

Los correos que envía la app en local (confirmación, recuperar contraseña) no salen a
internet: los ves en **Mailpit**, <http://127.0.0.1:54324>.

Para el 2FA del admin usa cualquier app autenticadora en tu celular (Google
Authenticator, Microsoft Authenticator o Authy).

## Comandos del día a día

| Comando                        | Qué hace                                                        |
| ------------------------------ | --------------------------------------------------------------- |
| `npm run dev`                  | Inicia la app en <http://localhost:3000> con recarga automática |
| `npm run build`                | Compila la versión de producción                                |
| `npm run start`                | Sirve la versión compilada                                      |
| `npm run lint`                 | Revisa errores comunes en el código (ESLint)                    |
| `npm run typecheck`            | Revisa los tipos de TypeScript                                  |
| `npm run format`               | Ordena el formato del código (Prettier)                         |
| `npm run test`                 | Corre las pruebas unitarias (Vitest)                            |
| `npm run test:e2e`             | Compila, levanta la app y corre las pruebas E2E (Playwright)    |
| `npm run test:e2e:ui`          | Igual, pero con la interfaz visual de Playwright                |
| `npm run check`                | Lint + tipos + formato + unitarias (lo mismo que revisa la CI)  |
| `npm run db:start` / `db:stop` | Enciende / apaga Supabase local                                 |
| `npm run db:reset`             | Borra la base local y la crea de nuevo (migraciones + seed)     |
| `npm run db:test`              | Pruebas de seguridad de la base de datos (RLS, pgTAP)           |
| `npm run db:types`             | Regenera los tipos de TypeScript a partir de la base de datos   |

Las pruebas E2E necesitan Supabase local encendido (`npm run db:start`).
Para correr solo el proyecto móvil de Playwright: `npx playwright test --project=movil-360`.

## Estructura de carpetas

```
src/
  app/            Páginas y rutas (App Router). (sitio)/ = público y cuenta; admin/ = panel
  components/     Componentes de React. ui/ = base de shadcn/ui; forms/ = campos de formulario
  config/         Configuración general del sitio y versión de la política de datos
  lib/            Lógica reutilizable (entorno, seguridad, Supabase, formularios)
  modules/        Lógica por dominio: auth/ (cuentas y 2FA), admin/ (reglas del negocio),
                  booking/ (citas), payments/ (Wompi), notifications/ (correos), shop/ (tienda)
  proxy.ts        Se ejecuta antes de cada página (CSP con nonce + renovar la sesión)
supabase/
  migrations/     Cambios de la base de datos, en orden (nunca edites uno ya aplicado)
  tests/database/ Pruebas de seguridad de la base de datos (pgTAP)
  seed.sql        Datos de prueba para desarrollo local
e2e/              Pruebas de extremo a extremo (Playwright)
docs/             Estado del proyecto y decisiones técnicas
.github/          Integración continua (GitHub Actions) y Dependabot
```

En las próximas fases se agregan más módulos en `src/modules/` (preventas, portafolio).

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Reglas:

- Los secretos solo van en `.env.local` (local) o en Vercel; **nunca** en el código.
- Las variables `NEXT_PUBLIC_*` las puede ver cualquiera en el navegador.
- Las variables `NEXT_PUBLIC_*` se fijan al compilar: si cambias una en Vercel,
  vuelve a desplegar.

## Integración continua

Cada push a GitHub ejecuta `.github/workflows/ci.yml`:

1. Lint, tipos, formato, pruebas unitarias y auditoría de dependencias.
2. Supabase local en Docker, pruebas de seguridad de la base de datos, compilación y
   pruebas E2E en Chromium (escritorio y móvil 360 px) y WebKit (iPhone).

## Supabase en producción

Hazlo una vez (en tu computador, dentro de la carpeta del proyecto):

```bash
npx supabase login                               # abre el navegador para autorizar
npx supabase link --project-ref TU_PROJECT_REF   # el texto que va antes de .supabase.co
npx supabase db push                             # aplica las migraciones (NO el seed)
```

Luego, en el panel de Supabase (<https://supabase.com/dashboard>):

1. **Authentication → URL Configuration**
   - _Site URL_: tu dominio (ej.: `https://tudominio.com`). Mientras no tengas dominio,
     usa `http://localhost:3000`.
   - _Redirect URLs_: `https://tudominio.com/**` y `http://localhost:3000/**`.
2. **Authentication → Sign In / Providers → Email**: deja activo _Confirm email_, activa
   _Secure password change_ y pon _Minimum password length_ en **12**.
3. **Authentication → Multi-Factor**: verifica que _TOTP (App Authenticator)_ esté habilitado.
4. **Authentication → Rate Limits**: revisa los límites (los de la app son una capa extra).
5. **Crear la primera admin.** Regístrate normalmente en el sitio y luego, en
   **SQL Editor**, ejecuta (cambia el correo):

   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'tu-correo@ejemplo.com';
   ```

   Al entrar a `/admin` te pedirá configurar la verificación en dos pasos.

> Cada vez que haya migraciones nuevas: `npx supabase db push`.

## Pagos con Wompi

En local la app usa llaves **de mentira** (ver `.env.local`), suficientes para ver el botón de
pago y correr las pruebas; el pago real no funciona con ellas. Para probar contra Wompi:

1. Crea tu cuenta en <https://comercios.wompi.co> y usa el modo **Pruebas**.
2. En **Desarrolladores → Llaves del API** copia `pub_test_…`, `test_integrity_…` y
   `test_events_…` a `NEXT_PUBLIC_WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET` y
   `WOMPI_EVENTS_SECRET`.
3. En **Desarrolladores → URL de eventos** pon `https://TU-DOMINIO/api/webhooks/wompi`
   (Wompi no puede avisarle a `localhost`; en local, al volver del checkout la app consulta el
   resultado directamente en Wompi).
4. Las tarjetas y datos de prueba están en la documentación de Wompi: <https://docs.wompi.co>.

## Tienda y fotos de productos

- Los productos, categorías y fotos se manejan en `/admin/productos`; los pedidos en
  `/admin/pedidos`; la tarifa de envío en `/admin/reglas`.
- Las fotos van al bucket público `productos` de Supabase Storage (lo crea la migración). JPG,
  PNG o WebP de hasta 5 MB.
- Los pagos de pedidos usan las mismas llaves y el mismo webhook de Wompi que las citas.
- En local las fotos se muestran sin optimizar (Supabase local usa http); en producción
  `next/image` las optimiza.

## Correos y recordatorios

La app envía dos correos de citas: la **confirmación** (cuando se paga el anticipo o el saldo a
favor lo cubre) y el **recordatorio** (el día anterior a las 9 a. m., hora de Colombia).

- **En local** los correos llegan al buzón de pruebas de Supabase (Mailpit):
  <http://127.0.0.1:54324>. Solo necesitas `MAILPIT_URL=http://127.0.0.1:54324` en `.env.local`.
- **En producción** se envían con [Resend](https://resend.com):
  1. Crea la cuenta, agrega y verifica tu dominio (Resend te muestra los registros DNS).
  2. Crea una API key y ponla en Vercel como `RESEND_API_KEY`.
  3. Pon en `EMAIL_FROM` el remitente, por ejemplo `Estudio <citas@tudominio.com>`.

Si no hay ningún proveedor configurado, la app sigue funcionando y solo deja un aviso en el
registro del servidor.

**Recordatorios y saldo vencido (Vercel Cron):** `vercel.json` programa `/api/cron/recordatorios`
todos los días a las 14:00 UTC (9 a. m. en Colombia). Envía los recordatorios de mañana y deja
registrado el saldo a favor que ya venció. Para que funcione, agrega en Vercel la variable
`CRON_SECRET` con un valor largo al azar (`openssl rand -hex 32`); Vercel lo envía solo y la ruta
rechaza cualquier llamada sin él. Para probarla en local:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" http://localhost:3000/api/cron/recordatorios
```

## Despliegue en Vercel

1. Entra a <https://vercel.com/new> e importa el repositorio `Maquillaje-app`.
2. Vercel detecta Next.js solo; no cambies los comandos.
3. En **Environment Variables** agrega las variables de `.env.example`
   (con `NEXT_PUBLIC_SITE_URL` igual a tu dominio real y las claves del Supabase de producción).
4. Pulsa **Deploy**. Cada push a `main` desplegará automáticamente.

El paso a paso detallado (dominio y Sentry) se completa en la Fase 8.

# Maquillaje App

Aplicación web _mobile-first_ e instalable (PWA) para un negocio de maquillaje:
agendamiento de citas con anticipo, tienda en línea, preventas, portafolio y
panel de administración.

> Estado actual y próximos pasos: [`docs/estado.md`](docs/estado.md).
> Por qué se tomó cada decisión técnica: [`docs/decisiones.md`](docs/decisiones.md).

## Tecnologías

| Pieza                           | Herramienta                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| Frontend y backend              | Next.js 16 (App Router) + TypeScript estricto                  |
| Estilos                         | Tailwind CSS 4 + componentes shadcn/ui                         |
| Base de datos, login y archivos | Supabase (PostgreSQL + Auth + Storage) con RLS                 |
| Validación                      | Zod                                                            |
| Pruebas                         | Vitest (unitarias) y Playwright (E2E, incluye móvil de 360 px) |
| Errores                         | Sentry                                                         |
| Hosting                         | Vercel                                                         |

## Requisitos

- **Node.js 22** o superior → <https://nodejs.org> (verifica con `node -v`).
- **Git** → <https://git-scm.com>.

## Instalación (primera vez)

```bash
git clone https://github.com/lgballes13/Maquillaje-app.git
cd Maquillaje-app
npm install
cp .env.example .env.local      # en Windows (PowerShell): copy .env.example .env.local
npx playwright install          # descarga los navegadores para las pruebas E2E
```

Luego abre `.env.local` y llena los valores (cada variable está explicada en el
archivo).

## Comandos del día a día

| Comando               | Qué hace                                                        |
| --------------------- | --------------------------------------------------------------- |
| `npm run dev`         | Inicia la app en <http://localhost:3000> con recarga automática |
| `npm run build`       | Compila la versión de producción                                |
| `npm run start`       | Sirve la versión compilada                                      |
| `npm run lint`        | Revisa errores comunes en el código (ESLint)                    |
| `npm run typecheck`   | Revisa los tipos de TypeScript                                  |
| `npm run format`      | Ordena el formato del código (Prettier)                         |
| `npm run test`        | Corre las pruebas unitarias (Vitest)                            |
| `npm run test:e2e`    | Compila, levanta la app y corre las pruebas E2E (Playwright)    |
| `npm run test:e2e:ui` | Igual, pero con la interfaz visual de Playwright                |
| `npm run check`       | Lint + tipos + formato + unitarias (lo mismo que revisa la CI)  |

Para correr solo el proyecto móvil de Playwright:
`npx playwright test --project=movil-360`.

## Estructura de carpetas

```
src/
  app/            Páginas y rutas (App Router). api/ = endpoints del servidor
  components/     Componentes de React. ui/ = componentes base de shadcn/ui
  config/         Configuración general del sitio
  lib/            Lógica reutilizable (validación de entorno, seguridad, utilidades)
  proxy.ts        Se ejecuta antes de cada página (CSP con nonce)
e2e/              Pruebas de extremo a extremo (Playwright)
docs/             Estado del proyecto y decisiones técnicas
.github/          Integración continua (GitHub Actions) y Dependabot
```

A partir de la Fase 1 se agregan los módulos por dominio dentro de
`src/modules/` (citas, tienda, preventas, portafolio, admin) y la carpeta
`supabase/` con las migraciones de la base de datos.

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Reglas:

- Los secretos solo van en `.env.local` (local) o en Vercel; **nunca** en el código.
- Las variables `NEXT_PUBLIC_*` las puede ver cualquiera en el navegador.
- Las variables `NEXT_PUBLIC_*` se fijan al compilar: si cambias una en Vercel,
  vuelve a desplegar.

## Integración continua

Cada push a GitHub ejecuta `.github/workflows/ci.yml`:

1. Lint, tipos, formato, pruebas unitarias y auditoría de dependencias.
2. Compilación y pruebas E2E en Chromium (escritorio y móvil 360 px) y WebKit (iPhone).

## Despliegue en Vercel

1. Entra a <https://vercel.com/new> e importa el repositorio `Maquillaje-app`.
2. Vercel detecta Next.js solo; no cambies los comandos.
3. En **Environment Variables** agrega las variables de `.env.example`
   (con `NEXT_PUBLIC_SITE_URL` igual a tu dominio real).
4. Pulsa **Deploy**. Cada push a `main` desplegará automáticamente.

El paso a paso detallado (dominio, Supabase y Sentry) se completa en la Fase 8.

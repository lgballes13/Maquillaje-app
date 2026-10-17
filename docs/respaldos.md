# Respaldos de la base de datos

Cada día a las 3:00 a. m. (hora de Colombia), GitHub saca una copia de la base de datos de
producción. La cifra y la guarda 30 días. Lo hace el flujo `.github/workflows/respaldo.yml`
(decisión DT-041).

- **Qué copia:** los roles, la estructura (tablas, reglas y funciones) y todos los datos, incluidas
  las cuentas.
- **Qué no copia:** los archivos de Storage, es decir, las fotos de productos y del portafolio y
  los formatos de autorización firmados. Ver «Archivos» al final.
- **Dónde queda:** en GitHub → pestaña **Actions** → **Respaldo diario** → cada ejecución tiene un
  archivo `respaldo-AAAA-MM-DD.tar.gz.age`. Está cifrado: sin tu clave privada nadie lo puede abrir,
  ni siquiera GitHub.

## Configurarlo (una sola vez)

Hazlo en tu computador. Necesitas [age](https://github.com/FiloSottile/age), un programa
pequeño para cifrar archivos.

- **Mac:** `brew install age`
- **Windows:** `winget install FiloSottile.age`
- **Linux:** `sudo apt install age`

1. **Crea tu par de claves:**

   ```bash
   age-keygen -o clave-respaldos.txt
   ```

   El comando muestra una línea `Public key: age1…`. Esa es la clave **pública**: no es secreta
   y se puede compartir.

   El archivo `clave-respaldos.txt` tiene la clave **privada**:
   - Guárdala en tu gestor de contraseñas y en una memoria USB.
   - **Nunca la subas a GitHub ni la pegues en el chat.**
   - Si la pierdes, nadie podrá abrir los respaldos.

2. **Copia la cadena de conexión de Supabase:** en el panel de Supabase pulsa **Connect** (arriba)
   → **Session pooler** → copia la URI, la que empieza por `postgresql://postgres.`. Cambia
   `[YOUR-PASSWORD]` por la contraseña de la base de datos.

3. **Guárdala en GitHub como secreto:** en el repositorio ve a **Settings → Secrets and variables
   → Actions → New repository secret**.
   - Nombre: `SUPABASE_DB_URL`
   - Valor: la URI del paso 2.

4. **Guarda la clave pública como variable:** en la misma pantalla, pestaña **Variables**, pulsa
   **New repository variable**.
   - Nombre: `BACKUP_AGE_RECIPIENT`
   - Valor: la clave pública `age1…` del paso 1.

5. **Pruébalo:** ve a **Actions → Respaldo diario → Run workflow**. Cuando termine en verde,
   descarga el archivo y ábrelo (siguiente sección) para confirmar que funciona.

Mientras falte el secreto o la variable, el flujo termina en verde sin hacer nada: no es un error.

## Abrir un respaldo

1. Descarga el `.zip` desde la ejecución en GitHub Actions y descomprímelo.
2. Descífralo con tu clave privada:

   ```bash
   age -d -i clave-respaldos.txt respaldo-2026-10-20.tar.gz.age | tar xzf -
   ```

   Queda una carpeta `respaldo/` con `roles.sql`, `estructura.sql` y `datos.sql`.

## Restaurar

Estos pasos siguen la guía oficial de Supabase: <https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>.

Restaura **en un proyecto nuevo de Supabase**, no encima del que está funcionando. Así, si algo
sale mal, no pierdes nada.

1. Crea un proyecto nuevo en Supabase y copia su URI del **Session pooler** (como en el paso 2 de
   la configuración).
2. Necesitas `psql`, que viene con PostgreSQL. Ejecuta:

   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --file respaldo/roles.sql \
     --file respaldo/estructura.sql \
     --command 'SET session_replication_role = replica' \
     --file respaldo/datos.sql \
     --dbname "URI_DEL_PROYECTO_NUEVO"
   ```

3. **Configura el proyecto nuevo** igual que el anterior (Auth, URLs y 2FA), con los pasos de
   «Supabase en producción» en el README.
4. **Apunta Vercel al proyecto nuevo:** cambia `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`, y vuelve a desplegar.
5. **Actualiza el secreto `SUPABASE_DB_URL` en GitHub** con la URI del proyecto nuevo.

**Recomendación:** haz un simulacro de restauración en un proyecto de prueba la primera semana, y
después cada pocos meses. Un respaldo que nunca se ha restaurado no está probado.

## Archivos (fotos y formatos firmados)

Los archivos de Storage no entran en este respaldo. Mientras tanto:

- **Formatos de autorización firmados:** guarda también el original en papel o en tu Drive. Son
  la prueba legal de la autorización.
- **Fotos de productos y del portafolio:** conserva los originales en tu computador o en tu Drive.

Si más adelante pasas a **Supabase Pro**, Supabase hace sus propios respaldos diarios. Este flujo
se puede dejar como segunda copia o apagar.

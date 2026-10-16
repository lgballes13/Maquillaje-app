/**
 * Construye la Content Security Policy (CSP).
 * La CSP le dice al navegador de qué orígenes puede cargar scripts, estilos,
 * imágenes, etc. Es la principal defensa contra XSS (inyección de scripts).
 *
 * Usamos un "nonce": un valor aleatorio distinto en cada petición. Solo los
 * scripts que lleven ese nonce se ejecutan; un script inyectado no lo conoce.
 */
export interface CspOptions {
  nonce: string;
  isDev: boolean;
  /** URL del proyecto Supabase (API, Auth, Storage). */
  supabaseUrl?: string;
}

export function buildCsp({ nonce, isDev, supabaseUrl }: CspOptions): string {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : null;
  const supabaseWs = supabaseOrigin ? supabaseOrigin.replace(/^https:/, "wss:") : null;

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'strict-dynamic' permite que los scripts con nonce carguen sus propios módulos.
    // 'unsafe-eval' solo en desarrollo (React lo usa para depurar); nunca en producción.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", `'nonce-${nonce}'`],
    "img-src": ["'self'", "blob:", "data:", ...(supabaseOrigin ? [supabaseOrigin] : [])],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      ...(supabaseOrigin ? [supabaseOrigin] : []),
      ...(supabaseWs ? [supabaseWs] : []),
      ...(isDev ? ["ws:"] : []),
    ],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
  };

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");

  // En producción forzamos HTTPS para cualquier recurso.
  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}

/** Genera un nonce aleatorio criptográficamente seguro (base64). */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

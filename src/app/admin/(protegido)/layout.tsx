import { requireAdmin } from "@/modules/auth/session";

/**
 * Todo lo que está dentro de (protegido) exige: sesión + rol admin + 2FA
 * verificado en esta sesión. Si falta algo, requireAdmin redirige.
 */
export default async function ProtectedAdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin("/admin");
  return children;
}

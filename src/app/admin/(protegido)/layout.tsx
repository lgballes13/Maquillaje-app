import { AdminSidebar } from "@/components/admin-sidebar";
import { requireAdmin } from "@/modules/auth/session";

/**
 * Todo lo que está dentro de (protegido) exige: sesión + rol admin + 2FA
 * verificado en esta sesión. Si falta algo, requireAdmin redirige.
 */
export default async function ProtectedAdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin("/admin");
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

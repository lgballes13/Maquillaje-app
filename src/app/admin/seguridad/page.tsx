import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { TotpEnrollment } from "@/modules/admin/components/totp-enrollment";
import { getAdminAccess } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

// Primer ingreso del admin: debe configurar el segundo factor antes de usar el panel.
export default async function AdminSecurityPage() {
  const { access } = await getAdminAccess();
  if (access === "login") redirect("/ingresar?next=/admin");
  if (access === "forbidden") notFound();
  if (access === "verify") redirect("/admin/verificar");
  if (access === "allow") redirect("/admin");

  return (
    <AuthCard
      title="Activa la verificación en dos pasos"
      description="Para proteger el panel, además de tu contraseña pediremos un código de 6 números de una app en tu celular. Es obligatorio para administradores."
    >
      <TotpEnrollment />
    </AuthCard>
  );
}

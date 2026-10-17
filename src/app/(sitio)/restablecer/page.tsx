import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { UpdatePasswordForm } from "@/modules/auth/components/update-password-form";
import { getCurrentUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

// Se llega aquí desde el enlace del correo de recuperación (ya con sesión iniciada).
export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthCard
        title="El enlace venció"
        description="Por seguridad, los enlaces de recuperación duran poco tiempo."
      >
        <Link
          href="/recuperar"
          className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
        >
          Pedir un enlace nuevo
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Crea una contraseña nueva">
      <UpdatePasswordForm />
    </AuthCard>
  );
}

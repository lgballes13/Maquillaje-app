import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { RequestResetForm } from "@/modules/auth/components/request-reset-form";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false } };

export default function RequestResetPage() {
  return (
    <AuthCard
      title="Recuperar contraseña"
      description="Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva."
      footer={
        <Link
          href="/ingresar"
          className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
        >
          Volver a ingresar
        </Link>
      }
    >
      <RequestResetForm />
    </AuthCard>
  );
}

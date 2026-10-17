import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { SignUpForm } from "@/modules/auth/components/sign-up-form";
import { getCurrentUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false } };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/cuenta");

  return (
    <AuthCard
      title="Crear cuenta"
      description="Con tu cuenta podrás agendar citas, comprar y seguir tus pedidos."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/ingresar"
            className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
          >
            Ingresar
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
